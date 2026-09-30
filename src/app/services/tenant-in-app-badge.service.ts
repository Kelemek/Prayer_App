import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';
import {
  countDisplayedInAppPrayerBadgesAcrossTenants,
  emptyInAppBadgeReadState,
  listMemberTenantIds,
  promptsCacheKeyForTenant,
  readAllTenantInAppBadgeSnapshots,
  receiptsToReadState,
  unionInAppBadgeReadState,
  type InAppBadgeReadState,
  type InAppBadgeReceiptRow,
} from '../lib/in-app-prayer-badge-count';
import { sharedPrayersCacheKey } from '../lib/prayer-tenant';
import {
  applyScopedReadStateFromStorage,
  persistScopedReadState,
  resolveTenantScopedReadCacheKey,
  tenantBadgePendingSeedKey,
} from '../lib/tenant-in-app-badge-read-cache';
import {
  planTenantBadgeLegacyMigration,
  removeTenantBadgeLegacyStorageKeys,
} from '../lib/tenant-in-app-badge-legacy-migrate';
import { TenantInAppBadgeReceiptSync } from '../lib/tenant-in-app-badge-receipts';
import {
  BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS,
  INDIVIDUAL_BADGE_SUBJECT_CAP,
} from '../lib/tenant-in-app-badge.constants';
import {
  TenantInAppBadgeCountOps,
  type TenantInAppBadgeCountHost,
} from '../lib/tenant-in-app-badge-count.ops';
import {
  TenantInAppBadgeMarkReadOps,
  type TenantInAppBadgeMarkReadHost,
} from '../lib/tenant-in-app-badge-mark-read.ops';
import {
  createLocalStorageAllTenantInAppBadgeHydrateDeps,
  hydrateMissingTenantInAppBadgeCaches,
} from '../lib/all-tenant-in-app-badge-hydrate';

export {
  BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS,
  INDIVIDUAL_BADGE_SUBJECT_CAP,
};

/**
 * Tenant-scoped in-app badges (church prayers + prompts): read receipts,
 * counts, and mark-read. Group prayer badges live in GroupPrayerBadgeService.
 */
@Injectable({
  providedIn: 'root',
})
export class TenantInAppBadgeService {
  private badgeCountSubject$ = new Map<string, BehaviorSubject<number>>();
  private statusBadgeCountSubject$ = new Map<string, BehaviorSubject<number>>();
  private individualBadgeSubject$ = new Map<string, BehaviorSubject<boolean>>();
  private updateBadgesChanged$ = new Subject<void>();
  private badgeFunctionalityEnabled$ = new BehaviorSubject<boolean>(false);
  private readState: InAppBadgeReadState = emptyInAppBadgeReadState();
  private loadGeneration = 0;
  private readonly receiptSync: TenantInAppBadgeReceiptSync;
  private otherTenantHydrateInFlight: Promise<void> | null = null;
  private otherTenantHydrateRequested = false;
  private pendingSeedAllAsRead = false;
  private readonly counts: TenantInAppBadgeCountOps;
  private readonly markRead: TenantInAppBadgeMarkReadOps;

  currentUserEmail: string | null = null;

  private userSessionService: UserSessionService | null = null;
  private tenantContext: TenantContextService | null = null;

  constructor(
    private supabase: SupabaseService,
    private injector: Injector
  ) {
    this.receiptSync = new TenantInAppBadgeReceiptSync(this.supabase.client);
    this.initializeBadgeSubjects();

    const countHost: TenantInAppBadgeCountHost = {
      getPrayersCacheStorageKey: () => this.getPrayersCacheStorageKey(),
      getPromptsCacheStorageKey: () => this.getPromptsCacheStorageKey(),
      getActiveUserEmail: () => this.getActiveUserEmail(),
      getReadState: () => this.readState,
      emitBadgesChanged: () => this.updateBadgesChanged$.next(),
    };
    this.counts = new TenantInAppBadgeCountOps(
      countHost,
      this.badgeCountSubject$,
      this.statusBadgeCountSubject$,
      this.individualBadgeSubject$
    );

    const markHost: TenantInAppBadgeMarkReadHost = {
      getPrayersCacheStorageKey: () => this.getPrayersCacheStorageKey(),
      getPromptsCacheStorageKey: () => this.getPromptsCacheStorageKey(),
      getPendingSeedKey: () => this.getPendingSeedKey(),
      getReadState: () => this.readState,
      setReadState: (state) => {
        this.readState = state;
      },
      getPendingSeedAllAsRead: () => this.pendingSeedAllAsRead,
      setPendingSeedAllAsRead: (value) => {
        this.pendingSeedAllAsRead = value;
      },
      persistReadStateLocally: () => this.persistReadStateLocally(),
      queueReceiptUpsert: (receipts) => {
        void this.upsertReceiptsToDatabase(receipts);
      },
      notifyBadgesChanged: () => this.updateBadgesChanged$.next(),
    };
    this.markRead = new TenantInAppBadgeMarkReadOps(markHost, this.counts);
  }

  private getPrayersCacheStorageKey(): string {
    const tid = this.getTenantContext().getActiveTenant()?.id;
    return tid ? sharedPrayersCacheKey(tid) : 'prayers_cache';
  }

  private getPromptsCacheStorageKey(): string {
    const tid = this.getTenantContext().getActiveTenant()?.id;
    return tid ? promptsCacheKeyForTenant(tid) : 'prompts_cache';
  }

  private getTenantContext(): TenantContextService {
    if (!this.tenantContext) {
      this.tenantContext = this.injector.get(TenantContextService);
    }
    return this.tenantContext;
  }

  private getUserSessionService(): UserSessionService {
    if (!this.userSessionService) {
      this.userSessionService = this.injector.get(UserSessionService);
    }
    return this.userSessionService;
  }

  private getActiveTenantId(): string | null {
    return this.getTenantContext().getActiveTenant()?.id ?? null;
  }

  private getActiveUserEmail(): string | null {
    const fromSession = this.getUserSessionService().getUserEmail?.() ?? null;
    const email = (fromSession || this.currentUserEmail || '').trim();
    return email ? email.toLowerCase() : null;
  }

  getViewerEmailForBadges(): string | null {
    return this.getActiveUserEmail();
  }

  getScopedReadCacheKeyForActiveUser(): string | null {
    return this.getScopedReadCacheKey();
  }

  isBadgeFunctionalityEnabled(): boolean {
    return this.badgeFunctionalityEnabled$.value;
  }

  hasPendingSeedAllAsRead(): boolean {
    return this.pendingSeedAllAsRead;
  }

  setPendingSeedAllAsRead(value: boolean): void {
    this.pendingSeedAllAsRead = value;
  }

  getSyncInFlight(): Promise<void> | null {
    return this.receiptSync.getSyncInFlight();
  }

  hasCachedTenantBadgeContent(): boolean {
    return this.markRead.hasCachedTenantBadgeContent();
  }

  persistPendingSeedFlag(pending: boolean): void {
    this.markRead.persistPendingSeedFlag(pending);
  }

  syncPendingSeedFlagFromStorage(): void {
    this.markRead.restorePendingSeedFlag();
  }

  private getScopedReadCacheKey(): string | null {
    return resolveTenantScopedReadCacheKey(
      this.getActiveTenantId(),
      this.getActiveUserEmail()
    );
  }

  private getPendingSeedKey(): string | null {
    const email = this.getActiveUserEmail();
    const tenantId = this.getActiveTenantId();
    if (!email || !tenantId) {
      return null;
    }
    return tenantBadgePendingSeedKey(tenantId, email);
  }

  applyUserSession(session: {
    email?: string | null;
    badgeFunctionalityEnabled?: boolean;
  }): void {
    this.currentUserEmail = session.email
      ? session.email.toLowerCase().trim()
      : null;
    this.badgeFunctionalityEnabled$.next(session.badgeFunctionalityEnabled ?? false);
  }

  getIndividualBadgeSubjectsForTests(): Map<string, BehaviorSubject<boolean>> {
    return this.individualBadgeSubject$;
  }

  getBadgeEnabledSubjectForTests(): BehaviorSubject<boolean> {
    return this.badgeFunctionalityEnabled$;
  }

  getLastReceiptNetworkSyncAtForTests(): number | null {
    return this.receiptSync.lastNetworkSyncAt;
  }

  setLastReceiptNetworkSyncAtForTests(value: number | null): void {
    this.receiptSync.lastNetworkSyncAt = value;
  }

  clearSessionBadgeState(): void {
    this.currentUserEmail = null;
    this.badgeFunctionalityEnabled$.next(false);
    this.pendingSeedAllAsRead = false;
    this.readState = emptyInAppBadgeReadState();
    this.counts.clearIndividualBadgeSubjects();
    this.refreshBadgeCounts();
  }

  private initializeBadgeSubjects(): void {
    this.badgeCountSubject$.set('prayers', new BehaviorSubject<number>(0));
    this.badgeCountSubject$.set('prompts', new BehaviorSubject<number>(0));
    this.statusBadgeCountSubject$.set(
      'prayers_current',
      new BehaviorSubject<number>(0)
    );
    this.statusBadgeCountSubject$.set(
      'prayers_answered',
      new BehaviorSubject<number>(0)
    );
  }

  private hasWarmReadCache(): boolean {
    const key = this.getScopedReadCacheKey();
    if (!key || typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(key) != null;
  }

  async refreshReadStateOnForeground(): Promise<void> {
    const warm = this.hasWarmReadCache();
    const fresh =
      this.receiptSync.lastNetworkSyncAt != null &&
      Date.now() - this.receiptSync.lastNetworkSyncAt <
        BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS;
    if (warm && fresh) {
      this.applyLocalCacheToMemory();
      this.refreshBadgeCounts();
      return;
    }
    await this.reloadReadStateFromSources();
  }

  async reloadReadStateFromSources(): Promise<void> {
    const generation = ++this.loadGeneration;

    this.markRead.restorePendingSeedFlag();
    this.applyLocalCacheToMemory();
    await this.migrateLegacyLocalStorageIfNeeded();
    if (generation !== this.loadGeneration) {
      return;
    }
    this.refreshBadgeCounts();

    await this.loadReceiptsFromDatabase();
    if (generation !== this.loadGeneration) {
      return;
    }
    this.refreshBadgeCounts();
    void this.ensureAllTenantInAppBadgeCaches();
  }

  getUpdateBadgesChanged$(): Observable<void> {
    return this.updateBadgesChanged$.asObservable();
  }

  getBadgeFunctionalityEnabled$(): Observable<boolean> {
    return this.badgeFunctionalityEnabled$.asObservable();
  }

  getPrayerBadgesChanged$(_status: 'current' | 'answered'): Observable<void> {
    return this.updateBadgesChanged$.asObservable();
  }

  markPrayerAsRead(prayerId: string): void {
    this.markRead.markPrayerAsRead(prayerId);
  }

  markPromptAsRead(promptId: string): void {
    this.markRead.markPromptAsRead(promptId);
  }

  markUpdateAsRead(
    updateId: string,
    itemId: string,
    type: 'prayers' | 'prompts'
  ): void {
    this.markRead.markUpdateAsRead(updateId, itemId, type);
  }

  markAllAsRead(type: 'prayers' | 'prompts'): void {
    this.markRead.markAllAsRead(type);
  }

  markAllAsReadByStatus(
    type: 'prayers' | 'prompts',
    status: 'current' | 'answered'
  ): void {
    this.markRead.markAllAsReadByStatus(type, status);
  }

  markAllAsReadByPromptType(promptType: string): void {
    this.markRead.markAllAsReadByPromptType(promptType);
  }

  markAllCachedItemsAsRead(): void {
    this.markRead.markAllCachedItemsAsRead();
  }

  getBadgeCount$(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): Observable<number> {
    return this.counts.getBadgeCount$(type, status);
  }

  sumAllTenantDisplayedBadgeCount(): number {
    const email = this.getActiveUserEmail();
    if (!email || typeof localStorage === 'undefined') {
      return 0;
    }
    const tenantIds = this.getAllMemberTenantIds();
    if (tenantIds.length === 0) {
      return 0;
    }
    return countDisplayedInAppPrayerBadgesAcrossTenants(
      readAllTenantInAppBadgeSnapshots(
        localStorage,
        tenantIds,
        email,
        this.getActiveTenantId(),
        this.readState
      ),
      email
    );
  }

  private getAllMemberTenantIds(): string[] {
    try {
      const ctx = this.getTenantContext();
      return listMemberTenantIds({
        memberTenants: ctx.getMemberTenants?.() ?? [],
        memberships: ctx.getMemberships?.() ?? [],
        activeTenantId: this.getActiveTenantId(),
      });
    } catch {
      return listMemberTenantIds({
        activeTenantId: this.getActiveTenantId(),
      });
    }
  }

  async ensureAllTenantInAppBadgeCaches(): Promise<void> {
    this.otherTenantHydrateRequested = true;
    if (this.otherTenantHydrateInFlight) {
      return this.otherTenantHydrateInFlight;
    }
    this.otherTenantHydrateInFlight = this.runOtherTenantHydrateLoop().finally(
      () => {
        this.otherTenantHydrateInFlight = null;
      }
    );
    return this.otherTenantHydrateInFlight;
  }

  private async runOtherTenantHydrateLoop(): Promise<void> {
    while (this.otherTenantHydrateRequested) {
      this.otherTenantHydrateRequested = false;
      const email = this.getActiveUserEmail();
      const tenantIds = this.getAllMemberTenantIds();
      const skipTenantId = this.getActiveTenantId();
      if (
        !email ||
        typeof localStorage === 'undefined' ||
        tenantIds.every((id) => !id || id === skipTenantId)
      ) {
        continue;
      }
      await hydrateMissingTenantInAppBadgeCaches(
        createLocalStorageAllTenantInAppBadgeHydrateDeps({
          storage: localStorage,
          client: this.supabase.client,
          email,
          tenantIds,
          skipTenantId,
        })
      );
      this.updateBadgesChanged$.next();
    }
  }

  hasIndividualBadge$(
    type: 'prayers' | 'prompts',
    id: string
  ): Observable<boolean> {
    return this.counts.hasIndividualBadge$(type, id);
  }

  getUnreadIds(type: 'prayers' | 'prompts'): string[] {
    return this.counts.getUnreadIds(type);
  }

  refreshBadgeCounts(): void {
    this.counts.refreshBadgeCounts();
  }

  isUpdateUnread(updateId: string): boolean {
    return this.counts.isUpdateUnread(updateId);
  }

  isPrayerUnread(prayerId: string): boolean {
    return this.counts.isPrayerUnread(prayerId);
  }

  isPromptUnread(promptId: string): boolean {
    return this.counts.isPromptUnread(promptId);
  }

  checkIndividualBadge(type: 'prayers' | 'prompts', id: string): boolean {
    return this.counts.checkIndividualBadge(type, id);
  }

  markItemUpdatesAsRead(
    itemId: string,
    type: 'prayers' | 'prompts'
  ): InAppBadgeReceiptRow[] {
    return this.markRead.markItemUpdatesAsRead(itemId, type);
  }

  applyLocalCacheToMemory(): void {
    const key = this.getScopedReadCacheKey();
    if (!key) {
      return;
    }
    this.readState = applyScopedReadStateFromStorage(
      key,
      this.readState,
      () => this.persistReadStateLocally()
    );
  }

  persistReadStateLocally(): void {
    persistScopedReadState(this.getScopedReadCacheKey(), this.readState);
  }

  async migrateLegacyLocalStorageIfNeeded(): Promise<void> {
    const email = this.getActiveUserEmail();
    const tenantId = this.getActiveTenantId();
    if (!email || !tenantId) {
      return;
    }

    const scopedKey = this.getScopedReadCacheKey();
    if (!scopedKey) {
      return;
    }

    const plan = planTenantBadgeLegacyMigration({
      email,
      tenantId,
      scopedKey,
      readState: this.readState,
      storage: localStorage,
    });
    if (plan.shouldSkip) {
      return;
    }

    this.readState = plan.mergedReadState;
    this.persistReadStateLocally();

    if (plan.receiptsToUpsert.length > 0) {
      await this.receiptSync.upsertReceipts(
        tenantId,
        email,
        plan.receiptsToUpsert
      );
    }

    removeTenantBadgeLegacyStorageKeys(email, localStorage);
  }

  async loadReceiptsFromDatabase(): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const email = this.getActiveUserEmail();
    if (!tenantId || !email) {
      return;
    }

    const rows = await this.receiptSync.loadReceipts(tenantId, email);
    if (!rows) {
      return;
    }
    this.readState = unionInAppBadgeReadState(
      this.readState,
      receiptsToReadState(rows)
    );
    this.persistReadStateLocally();
  }

  private async upsertReceiptsToDatabase(
    receipts: InAppBadgeReceiptRow[]
  ): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const email = this.getActiveUserEmail();
    if (!tenantId || !email) {
      return;
    }
    await this.receiptSync.upsertReceipts(tenantId, email, receipts);
  }
}
