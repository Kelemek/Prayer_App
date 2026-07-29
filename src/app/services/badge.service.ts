import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, startWith } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Prayer or Prompt object structure
 */
interface CachedItem {
  id: string;
  status?: 'current' | 'answered' | 'archived';
  updated_at: string;
  updates?: Array<{ id: string; created_at: string; updated_at?: string }>;
}

type BadgeItemKind = 'prayer' | 'prayer_update' | 'prompt' | 'prompt_update';

interface BadgeReadState {
  prayers: string[];
  prayerUpdates: string[];
  prompts: string[];
  promptUpdates: string[];
}

interface BadgeReceiptRow {
  item_kind: BadgeItemKind;
  item_id: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function emptyReadState(): BadgeReadState {
  return {
    prayers: [],
    prayerUpdates: [],
    prompts: [],
    promptUpdates: [],
  };
}

/**
 * BadgeService tracks read/unread prayers and prompts to display notification badges.
 *
 * Read receipts are stored in Supabase (`badge_read_receipts`) per tenant membership
 * so unread badges sync across devices. A tenant+email localStorage cache is used
 * as a write-through mirror for snappy UI and offline use.
 */
@Injectable({
  providedIn: 'root',
})
export class BadgeService {
  /** @deprecated Legacy global keys; migrated once into DB + scoped cache. */
  private readonly LEGACY_READ_PRAYERS_DATA_KEY = 'read_prayers_data';
  private readonly LEGACY_READ_PROMPTS_DATA_KEY = 'read_prompts_data';

  private badgeCountSubject$ = new Map<string, BehaviorSubject<number>>();
  private statusBadgeCountSubject$ = new Map<string, BehaviorSubject<number>>();
  private individualBadgeSubject$ = new Map<string, BehaviorSubject<boolean>>();
  private updateBadgesChanged$ = new Subject<void>();
  private badgeFunctionalityEnabled$ = new BehaviorSubject<boolean>(false);
  private storageListenerAttached = false;
  private visibilityListenerAttached = false;

  private readState: BadgeReadState = emptyReadState();
  private loadGeneration = 0;
  private syncInFlight: Promise<void> | null = null;
  private currentUserEmail: string | null = null;
  /** When true, mark all cached items read once prayer/prompt caches are available. */
  private pendingSeedAllAsRead = false;

  // Use Injector to avoid circular dependency with UserSessionService
  private userSessionService: UserSessionService | null = null;
  private tenantContext: TenantContextService | null = null;

  constructor(
    private supabase: SupabaseService,
    private injector: Injector
  ) {
    this.initializeBadgeSubjects();
    this.attachStorageListener();
    this.attachVisibilityListener();
    this.attachUserSessionListener();
    this.attachTenantChangeListener();
  }

  /** localStorage keys must match PrayerService / PromptService cache keys for the active tenant. */
  private getPrayersCacheStorageKey(): string {
    const tid = this.getTenantContext().getActiveTenant()?.id;
    return tid ? `tenant_${tid}_prayers` : 'prayers_cache';
  }

  private getPromptsCacheStorageKey(): string {
    const tid = this.getTenantContext().getActiveTenant()?.id;
    return tid ? `prompts:${tid}` : 'prompts_cache';
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

  private getScopedReadCacheKey(): string | null {
    const email = this.getActiveUserEmail();
    const tenantId = this.getActiveTenantId();
    // Require a real tenant so we never orphan receipts under badge_read:_none_:...
    if (!email || !tenantId) {
      return null;
    }
    return `badge_read:${tenantId}:${email}`;
  }

  private getPendingSeedKey(): string | null {
    const email = this.getActiveUserEmail();
    const tenantId = this.getActiveTenantId();
    if (!email || !tenantId) {
      return null;
    }
    return `badge_seed_pending:${tenantId}:${email}`;
  }

  private getOrphanNoneCacheKey(email: string): string {
    return `badge_read:_none_:${email}`;
  }

  private attachTenantChangeListener(): void {
    setTimeout(() => {
      try {
        this.getTenantContext()
          .activeTenant$.pipe(distinctUntilChanged((a, b) => a?.id === b?.id))
          .subscribe(() => {
            void this.reloadReadStateFromSources();
          });
      } catch {
        // ignore
      }
    }, 0);
  }

  private attachUserSessionListener(): void {
    setTimeout(() => {
      this.getUserSessionService()
        .userSession$.pipe(
          distinctUntilChanged(
            (prev, curr) =>
              prev?.email === curr?.email &&
              prev?.badgeFunctionalityEnabled === curr?.badgeFunctionalityEnabled
          )
        )
        .subscribe((session) => {
          if (session) {
            this.currentUserEmail = session.email
              ? session.email.toLowerCase().trim()
              : null;
            const isEnabled = session.badgeFunctionalityEnabled ?? false;
            this.badgeFunctionalityEnabled$.next(isEnabled);
            void this.reloadReadStateFromSources();
          } else {
            this.currentUserEmail = null;
            this.badgeFunctionalityEnabled$.next(false);
            this.pendingSeedAllAsRead = false;
            this.readState = emptyReadState();
            this.refreshBadgeCounts();
          }
        });
    }, 0);
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

  private attachStorageListener(): void {
    if (this.storageListenerAttached) return;

    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith('badge_read:')) {
        return;
      }
      const scopedKey = this.getScopedReadCacheKey();
      if (scopedKey && event.key === scopedKey) {
        this.applyLocalCacheToMemory();
        this.refreshBadgeCounts();
      }
    });

    this.storageListenerAttached = true;
  }

  private attachVisibilityListener(): void {
    if (this.visibilityListenerAttached || typeof document === 'undefined') {
      return;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.reloadReadStateFromSources({ preferNetwork: true });
      }
    });

    this.visibilityListenerAttached = true;
  }

  /**
   * Load local mirror first (snappy), optionally migrate legacy keys, then sync from DB.
   */
  private async reloadReadStateFromSources(options?: {
    preferNetwork?: boolean;
  }): Promise<void> {
    const generation = ++this.loadGeneration;

    this.restorePendingSeedFlag();
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

    if (options?.preferNetwork) {
      // already loaded from DB above
    }
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
    this.markItemAsRead(prayerId, 'prayers');
  }

  markPromptAsRead(promptId: string): void {
    this.markItemAsRead(promptId, 'prompts');
  }

  markUpdateAsRead(
    updateId: string,
    itemId: string,
    type: 'prayers' | 'prompts'
  ): void {
    try {
      const kind: BadgeItemKind =
        type === 'prayers' ? 'prayer_update' : 'prompt_update';
      const added = this.addIdsToReadState(
        type === 'prayers' ? 'prayerUpdates' : 'promptUpdates',
        [updateId]
      );
      if (added.length > 0) {
        this.persistReadStateLocally();
        void this.upsertReceiptsToDatabase([{ item_kind: kind, item_id: updateId }]);
      }

      const cacheKey =
        type === 'prayers'
          ? this.getPrayersCacheStorageKey()
          : this.getPromptsCacheStorageKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const items = parsedCache?.data || parsedCache || [];
        const item = items.find((i: CachedItem) => i.id === itemId);
        const itemStatus = item?.status;

        this.updateBadgeCount(type);

        if (type === 'prayers' && itemStatus) {
          this.updateStatusBadgeCount(
            type,
            itemStatus as 'current' | 'answered'
          );
        }
      }

      const key = `${type}_${itemId}`;
      if (this.individualBadgeSubject$.has(key)) {
        const hasBadge = this.checkIndividualBadge(type, itemId);
        (
          this.individualBadgeSubject$.get(key) as BehaviorSubject<boolean>
        ).next(hasBadge);
      }

      this.updateBadgesChanged$.next();
    } catch (error) {
      console.warn(`Failed to mark update as read:`, error);
    }
  }

  markAllAsRead(type: 'prayers' | 'prompts'): void {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return;
      }
      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];
      if (!Array.isArray(items)) {
        return;
      }

      const ids = items.map((item: CachedItem) => item.id).filter(Boolean);
      const updateIds = this.collectUpdateIds(items);

      const receipts: BadgeReceiptRow[] = [];
      if (type === 'prayers') {
        this.addIdsToReadState('prayers', ids).forEach((id) =>
          receipts.push({ item_kind: 'prayer', item_id: id })
        );
        this.addIdsToReadState('prayerUpdates', updateIds).forEach((id) =>
          receipts.push({ item_kind: 'prayer_update', item_id: id })
        );
      } else {
        this.addIdsToReadState('prompts', ids).forEach((id) =>
          receipts.push({ item_kind: 'prompt', item_id: id })
        );
        this.addIdsToReadState('promptUpdates', updateIds).forEach((id) =>
          receipts.push({ item_kind: 'prompt_update', item_id: id })
        );
      }

      this.persistReadStateLocally();
      void this.upsertReceiptsToDatabase(receipts);

      items.forEach((item: CachedItem) => {
        const key = `${type}_${item.id}`;
        if (this.individualBadgeSubject$.has(key)) {
          (
            this.individualBadgeSubject$.get(key) as BehaviorSubject<boolean>
          ).next(false);
        }
      });

      this.refreshBadgeCounts();
      this.updateBadgesChanged$.next();
    } catch (error) {
      console.warn(`Failed to mark all ${type} as read:`, error);
    }
  }

  markAllAsReadByStatus(
    type: 'prayers' | 'prompts',
    status: 'current' | 'answered'
  ): void {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return;
      }
      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];
      if (!Array.isArray(items)) {
        return;
      }

      const itemsWithStatus = items.filter(
        (item: CachedItem) => item.status === status
      );
      const ids = itemsWithStatus.map((item: CachedItem) => item.id).filter(Boolean);
      const updateIds = this.collectUpdateIds(itemsWithStatus);

      const receipts: BadgeReceiptRow[] = [];
      if (type === 'prayers') {
        this.addIdsToReadState('prayers', ids).forEach((id) =>
          receipts.push({ item_kind: 'prayer', item_id: id })
        );
        this.addIdsToReadState('prayerUpdates', updateIds).forEach((id) =>
          receipts.push({ item_kind: 'prayer_update', item_id: id })
        );
      } else {
        this.addIdsToReadState('prompts', ids).forEach((id) =>
          receipts.push({ item_kind: 'prompt', item_id: id })
        );
        this.addIdsToReadState('promptUpdates', updateIds).forEach((id) =>
          receipts.push({ item_kind: 'prompt_update', item_id: id })
        );
      }

      this.persistReadStateLocally();
      void this.upsertReceiptsToDatabase(receipts);

      itemsWithStatus.forEach((item: CachedItem) => {
        const key = `${type}_${item.id}`;
        if (this.individualBadgeSubject$.has(key)) {
          (
            this.individualBadgeSubject$.get(key) as BehaviorSubject<boolean>
          ).next(false);
        }
      });

      this.refreshBadgeCounts();
      this.updateBadgesChanged$.next();
    } catch (error) {
      console.warn(
        `Failed to mark all ${type} with status ${status} as read:`,
        error
      );
    }
  }

  /**
   * Mark every cached prayer and prompt (and their updates) as read for the
   * active tenant. Used when enabling badge functionality. If caches are not
   * loaded yet, defers until refreshBadgeCounts sees content.
   */
  markAllCachedItemsAsRead(): void {
    this.pendingSeedAllAsRead = true;
    this.persistPendingSeedFlag(true);
    this.markAllAsRead('prayers');
    this.markAllAsRead('prompts');
    this.maybeClearPendingSeedAfterMarkAll();
  }

  private persistPendingSeedFlag(pending: boolean): void {
    const key = this.getPendingSeedKey();
    if (!key) {
      return;
    }
    try {
      if (pending) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }

  private restorePendingSeedFlag(): void {
    const key = this.getPendingSeedKey();
    if (!key) {
      return;
    }
    try {
      if (localStorage.getItem(key) === '1') {
        this.pendingSeedAllAsRead = true;
      }
    } catch {
      // ignore
    }
  }

  private cacheHasItems(type: 'prayers' | 'prompts'): boolean {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return false;
      }
      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  }

  private maybeClearPendingSeedAfterMarkAll(): void {
    if (!this.pendingSeedAllAsRead) {
      return;
    }
    // Clear only once at least one content cache has loaded (or both exist empty
    // after a successful load attempt is hard to detect). Prefer: clear when we
    // observed cache content and marked it, or when both caches exist as arrays.
    const prayersPresent = this.cacheHasItems('prayers');
    const promptsPresent = this.cacheHasItems('prompts');
    if (prayersPresent || promptsPresent) {
      this.pendingSeedAllAsRead = false;
      this.persistPendingSeedFlag(false);
    }
  }

  private maybeSeedPendingMarkAll(): void {
    this.restorePendingSeedFlag();
    if (!this.pendingSeedAllAsRead) {
      return;
    }
    if (!this.cacheHasItems('prayers') && !this.cacheHasItems('prompts')) {
      return;
    }
    this.markAllAsRead('prayers');
    this.markAllAsRead('prompts');
    this.pendingSeedAllAsRead = false;
    this.persistPendingSeedFlag(false);
  }

  getBadgeCount$(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): Observable<number> {
    return this.getBadgeCountInternal$(type, status);
  }

  hasIndividualBadge$(
    type: 'prayers' | 'prompts',
    id: string
  ): Observable<boolean> {
    const key = `${type}_${id}`;

    if (!this.individualBadgeSubject$.has(key)) {
      this.individualBadgeSubject$.set(key, new BehaviorSubject<boolean>(false));
    }

    return (
      this.individualBadgeSubject$.get(key) as BehaviorSubject<boolean>
    )
      .asObservable()
      .pipe(startWith(this.checkIndividualBadge(type, id)));
  }

  getUnreadIds(type: 'prayers' | 'prompts'): string[] {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return [];
      }

      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];

      if (!Array.isArray(items)) {
        return [];
      }

      const readIds =
        type === 'prayers' ? this.readState.prayers : this.readState.prompts;

      return items
        .filter((item: CachedItem) => !readIds.includes(item.id))
        .map((item: CachedItem) => item.id);
    } catch (error) {
      console.warn(`Failed to get unread IDs for ${type}:`, error);
      return [];
    }
  }

  private markItemAsRead(itemId: string, type: 'prayers' | 'prompts'): void {
    try {
      let itemStatus: string | undefined;
      const receipts: BadgeReceiptRow[] = [];

      if (type === 'prayers') {
        const added = this.addIdsToReadState('prayers', [itemId]);
        if (added.length > 0) {
          receipts.push({ item_kind: 'prayer', item_id: itemId });
        }
        const cacheKey = this.getPrayersCacheStorageKey();
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          const items = parsedCache?.data || parsedCache || [];
          const item = items.find((i: CachedItem) => i.id === itemId);
          itemStatus = item?.status;
        }
      } else {
        const added = this.addIdsToReadState('prompts', [itemId]);
        if (added.length > 0) {
          receipts.push({ item_kind: 'prompt', item_id: itemId });
        }
      }

      const updateReceipts = this.markItemUpdatesAsRead(itemId, type);
      receipts.push(...updateReceipts);

      this.persistReadStateLocally();
      void this.upsertReceiptsToDatabase(receipts);

      this.updateBadgeCount(type);

      if (type === 'prayers' && itemStatus) {
        this.updateStatusBadgeCount(
          type,
          itemStatus as 'current' | 'answered'
        );
      }

      const key = `${type}_${itemId}`;
      if (this.individualBadgeSubject$.has(key)) {
        (
          this.individualBadgeSubject$.get(key) as BehaviorSubject<boolean>
        ).next(false);
      }

      this.updateBadgesChanged$.next();
    } catch (error) {
      console.warn(`Failed to mark ${itemId} as read:`, error);
    }
  }

  private getBadgeCountInternal$(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): Observable<number> {
    const key = status ? `${type}_${status}` : type;

    let subject = status
      ? this.statusBadgeCountSubject$.get(key)
      : this.badgeCountSubject$.get(type);

    if (!subject) {
      subject = new BehaviorSubject<number>(0);
      if (status) {
        this.statusBadgeCountSubject$.set(key, subject);
      } else {
        this.badgeCountSubject$.set(type, subject);
      }
    }

    const currentCount = this.calculateBadgeCount(type, status);
    subject.next(currentCount);

    return subject.asObservable();
  }

  refreshBadgeCounts(): void {
    this.maybeSeedPendingMarkAll();
    this.preCreateIndividualBadgeSubjects();

    this.badgeCountSubject$.forEach((subject, key) => {
      if (key === 'prayers') {
        subject.next(this.calculateBadgeCount('prayers'));
      } else if (key === 'prompts') {
        subject.next(this.calculateBadgeCount('prompts'));
      }
    });

    this.statusBadgeCountSubject$.forEach((subject, key) => {
      const [type, status] = key.split('_') as [
        'prayers' | 'prompts',
        'current' | 'answered',
      ];
      subject.next(this.calculateBadgeCount(type, status));
    });

    this.individualBadgeSubject$.forEach((subject, key) => {
      const [type, ...idParts] = key.split('_');
      const id = idParts.join('_');
      subject.next(this.checkIndividualBadge(type as 'prayers' | 'prompts', id));
    });

    this.updateBadgesChanged$.next();
  }

  private preCreateIndividualBadgeSubjects(): void {
    try {
      const prayersCached = localStorage.getItem(this.getPrayersCacheStorageKey());
      if (prayersCached) {
        const parsedCache = JSON.parse(prayersCached);
        const prayers = parsedCache?.data || parsedCache || [];
        if (Array.isArray(prayers)) {
          prayers.forEach((prayer: CachedItem) => {
            const key = `prayers_${prayer.id}`;
            if (!this.individualBadgeSubject$.has(key)) {
              this.individualBadgeSubject$.set(
                key,
                new BehaviorSubject<boolean>(false)
              );
            }
          });
        }
      }

      const promptsCached = localStorage.getItem(this.getPromptsCacheStorageKey());
      if (promptsCached) {
        const parsedCache = JSON.parse(promptsCached);
        const prompts = parsedCache?.data || parsedCache || [];
        if (Array.isArray(prompts)) {
          prompts.forEach((prompt: CachedItem) => {
            const key = `prompts_${prompt.id}`;
            if (!this.individualBadgeSubject$.has(key)) {
              this.individualBadgeSubject$.set(
                key,
                new BehaviorSubject<boolean>(false)
              );
            }
          });
        }
      }
    } catch (error) {
      console.warn('[Badge] Failed to pre-create individual badge subjects:', error);
    }
  }

  private calculateBadgeCount(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): number {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return 0;
      }

      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];

      if (!Array.isArray(items)) {
        return 0;
      }

      const readIds =
        type === 'prayers' ? this.readState.prayers : this.readState.prompts;
      const readUpdateIds =
        type === 'prayers'
          ? this.readState.prayerUpdates
          : this.readState.promptUpdates;

      let count = 0;

      items.forEach((item: CachedItem) => {
        if (status && item.status !== status) {
          return;
        }

        if (!readIds.includes(item.id)) {
          count++;
        }

        if (item.updates && Array.isArray(item.updates)) {
          item.updates.forEach((update: { id: string }) => {
            if (!readUpdateIds.includes(update.id)) {
              count++;
            }
          });
        }
      });

      return count;
    } catch (error) {
      console.warn(`Failed to calculate badge count for ${type}:`, error);
      return 0;
    }
  }

  isUpdateUnread(updateId: string): boolean {
    return !this.readState.prayerUpdates.includes(updateId);
  }

  isPrayerUnread(prayerId: string): boolean {
    return !this.readState.prayers.includes(prayerId);
  }

  isPromptUnread(promptId: string): boolean {
    return !this.readState.prompts.includes(promptId);
  }

  private checkIndividualBadge(
    type: 'prayers' | 'prompts',
    id: string
  ): boolean {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return false;
      }

      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];

      if (!Array.isArray(items)) {
        return false;
      }

      const item = items.find((i: CachedItem) => i.id === id);
      if (!item) {
        return false;
      }

      const readIds =
        type === 'prayers' ? this.readState.prayers : this.readState.prompts;
      return !readIds.includes(id);
    } catch (error) {
      console.warn(`Failed to check individual badge for ${type}:${id}:`, error);
      return false;
    }
  }

  private collectUpdateIds(items: CachedItem[]): string[] {
    const allUpdateIds: string[] = [];
    items.forEach((item: CachedItem) => {
      if (item.updates && Array.isArray(item.updates)) {
        item.updates.forEach((update: { id?: string }) => {
          if (update.id && !allUpdateIds.includes(update.id)) {
            allUpdateIds.push(update.id);
          }
        });
      }
    });
    return allUpdateIds;
  }

  private markItemUpdatesAsRead(
    itemId: string,
    type: 'prayers' | 'prompts'
  ): BadgeReceiptRow[] {
    const cacheKey =
      type === 'prayers'
        ? this.getPrayersCacheStorageKey()
        : this.getPromptsCacheStorageKey();
    const receipts: BadgeReceiptRow[] = [];

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return receipts;
      }

      const parsedCache = JSON.parse(cached);
      const items = parsedCache?.data || parsedCache || [];
      if (!Array.isArray(items)) {
        return receipts;
      }

      const item = items.find((i: CachedItem) => i.id === itemId);
      if (!item?.updates || !Array.isArray(item.updates)) {
        return receipts;
      }

      const updateIds = item.updates
        .map((u: { id?: string }) => u.id)
        .filter((id: string | undefined): id is string => !!id);

      const field = type === 'prayers' ? 'prayerUpdates' : 'promptUpdates';
      const kind: BadgeItemKind =
        type === 'prayers' ? 'prayer_update' : 'prompt_update';
      this.addIdsToReadState(field, updateIds).forEach((id) =>
        receipts.push({ item_kind: kind, item_id: id })
      );
    } catch (error) {
      console.warn(`Failed to mark item updates as read:`, error);
    }

    return receipts;
  }

  private addIdsToReadState(
    field: keyof BadgeReadState,
    ids: string[]
  ): string[] {
    const added: string[] = [];
    const existing = new Set(this.readState[field]);
    for (const id of ids) {
      if (!id || existing.has(id)) {
        continue;
      }
      existing.add(id);
      added.push(id);
    }
    if (added.length > 0) {
      this.readState = {
        ...this.readState,
        [field]: Array.from(existing),
      };
    }
    return added;
  }

  private applyLocalCacheToMemory(): void {
    const key = this.getScopedReadCacheKey();
    if (!key) {
      // Keep in-memory marks until we know tenant+email.
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        // Persist any optimistic in-memory marks into the new scoped key.
        this.persistReadStateLocally();
        return;
      }
      const parsed = JSON.parse(stored);
      const fromCache: BadgeReadState = {
        prayers: Array.isArray(parsed?.prayers) ? parsed.prayers : [],
        prayerUpdates: Array.isArray(parsed?.prayerUpdates)
          ? parsed.prayerUpdates
          : Array.isArray(parsed?.updates)
            ? parsed.updates
            : [],
        prompts: Array.isArray(parsed?.prompts) ? parsed.prompts : [],
        promptUpdates: Array.isArray(parsed?.promptUpdates)
          ? parsed.promptUpdates
          : [],
      };
      // Union so optimistic marks are not wiped by a stale/empty cache read.
      this.readState = {
        prayers: Array.from(
          new Set([...fromCache.prayers, ...this.readState.prayers])
        ),
        prayerUpdates: Array.from(
          new Set([...fromCache.prayerUpdates, ...this.readState.prayerUpdates])
        ),
        prompts: Array.from(
          new Set([...fromCache.prompts, ...this.readState.prompts])
        ),
        promptUpdates: Array.from(
          new Set([...fromCache.promptUpdates, ...this.readState.promptUpdates])
        ),
      };
    } catch (error) {
      console.warn('[Badge] Failed to parse scoped read cache:', error);
    }
  }

  private persistReadStateLocally(): void {
    const key = this.getScopedReadCacheKey();
    if (!key) {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(this.readState));
    } catch (error) {
      console.warn('[Badge] Failed to persist scoped read cache:', error);
    }
  }

  private async migrateLegacyLocalStorageIfNeeded(): Promise<void> {
    const email = this.getActiveUserEmail();
    const tenantId = this.getActiveTenantId();
    // Defer until tenant+email are known so we never write/delete under _none_
    // or drop legacy keys before a DB upsert is possible.
    if (!email || !tenantId) {
      return;
    }

    const scopedKey = this.getScopedReadCacheKey();
    if (!scopedKey) {
      return;
    }

    const orphanNoneKey = this.getOrphanNoneCacheKey(email);
    const orphanNoneRaw = localStorage.getItem(orphanNoneKey);
    const hasScoped = !!localStorage.getItem(scopedKey);
    const legacyPrayers = localStorage.getItem(this.LEGACY_READ_PRAYERS_DATA_KEY);
    const legacyPrompts = localStorage.getItem(this.LEGACY_READ_PROMPTS_DATA_KEY);
    const veryOldPrayers = localStorage.getItem('read_prayers');
    const veryOldUpdates = localStorage.getItem('read_prayer_updates');
    const veryOldPrompts = localStorage.getItem('read_prompts');
    const veryOldPromptUpdates = localStorage.getItem('read_prompt_updates');

    if (
      hasScoped &&
      !orphanNoneRaw &&
      !legacyPrayers &&
      !legacyPrompts &&
      !veryOldPrayers &&
      !veryOldUpdates &&
      !veryOldPrompts &&
      !veryOldPromptUpdates
    ) {
      return;
    }

    const merged = { ...this.readState };

    const mergeLegacyPrayers = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const prayers = Array.isArray(parsed?.prayers)
          ? parsed.prayers
          : Array.isArray(parsed)
            ? parsed
            : [];
        const updates = Array.isArray(parsed?.updates)
          ? parsed.updates
          : Array.isArray(parsed?.prayerUpdates)
            ? parsed.prayerUpdates
            : [];
        merged.prayers = Array.from(new Set([...merged.prayers, ...prayers]));
        merged.prayerUpdates = Array.from(
          new Set([...merged.prayerUpdates, ...updates])
        );
      } catch {
        // ignore
      }
    };

    const mergeLegacyPrompts = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const prompts = Array.isArray(parsed?.prompts)
          ? parsed.prompts
          : Array.isArray(parsed)
            ? parsed
            : [];
        const updates = Array.isArray(parsed?.updates)
          ? parsed.updates
          : Array.isArray(parsed?.promptUpdates)
            ? parsed.promptUpdates
            : [];
        merged.prompts = Array.from(new Set([...merged.prompts, ...prompts]));
        merged.promptUpdates = Array.from(
          new Set([...merged.promptUpdates, ...updates])
        );
      } catch {
        // ignore
      }
    };

    // Prefer merging orphan _none_ cache first, then legacy keys.
    if (orphanNoneRaw) {
      try {
        const parsed = JSON.parse(orphanNoneRaw);
        mergeLegacyPrayers(JSON.stringify({
          prayers: parsed?.prayers,
          updates: parsed?.prayerUpdates ?? parsed?.updates,
        }));
        mergeLegacyPrompts(JSON.stringify({
          prompts: parsed?.prompts,
          updates: parsed?.promptUpdates ?? parsed?.updates,
        }));
      } catch {
        // ignore
      }
    }

    mergeLegacyPrayers(legacyPrayers);
    mergeLegacyPrompts(legacyPrompts);

    if (veryOldPrayers) {
      try {
        const prayers = JSON.parse(veryOldPrayers);
        if (Array.isArray(prayers)) {
          merged.prayers = Array.from(new Set([...merged.prayers, ...prayers]));
        }
      } catch {
        // ignore
      }
    }
    if (veryOldUpdates) {
      try {
        const updates = JSON.parse(veryOldUpdates);
        if (Array.isArray(updates)) {
          merged.prayerUpdates = Array.from(
            new Set([...merged.prayerUpdates, ...updates])
          );
        }
      } catch {
        // ignore
      }
    }
    if (veryOldPrompts) {
      try {
        const prompts = JSON.parse(veryOldPrompts);
        if (Array.isArray(prompts)) {
          merged.prompts = Array.from(new Set([...merged.prompts, ...prompts]));
        }
      } catch {
        // ignore
      }
    }
    if (veryOldPromptUpdates) {
      try {
        const updates = JSON.parse(veryOldPromptUpdates);
        if (Array.isArray(updates)) {
          merged.promptUpdates = Array.from(
            new Set([...merged.promptUpdates, ...updates])
          );
        }
      } catch {
        // ignore
      }
    }

    this.readState = merged;
    this.persistReadStateLocally();

    const receipts: BadgeReceiptRow[] = [
      ...merged.prayers.map((id) => ({
        item_kind: 'prayer' as const,
        item_id: id,
      })),
      ...merged.prayerUpdates.map((id) => ({
        item_kind: 'prayer_update' as const,
        item_id: id,
      })),
      ...merged.prompts.map((id) => ({
        item_kind: 'prompt' as const,
        item_id: id,
      })),
      ...merged.promptUpdates.map((id) => ({
        item_kind: 'prompt_update' as const,
        item_id: id,
      })),
    ];

    if (receipts.length > 0) {
      await this.upsertReceiptsToDatabase(receipts);
    }

    // Only remove legacy/orphan keys after tenant-scoped persist (+ attempted upsert).
    localStorage.removeItem(orphanNoneKey);
    localStorage.removeItem(this.LEGACY_READ_PRAYERS_DATA_KEY);
    localStorage.removeItem(this.LEGACY_READ_PROMPTS_DATA_KEY);
    localStorage.removeItem('read_prayers');
    localStorage.removeItem('read_prayer_updates');
    localStorage.removeItem('read_prompts');
    localStorage.removeItem('read_prompt_updates');
  }

  private async loadReceiptsFromDatabase(): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const email = this.getActiveUserEmail();
    if (!tenantId || !email) {
      return;
    }

    try {
      const { data, error } = await this.supabase.client.rpc(
        'get_badge_read_receipts',
        {
          p_tenant_id: tenantId,
          p_user_email: email,
        }
      );

      if (error) {
        console.warn('[Badge] Failed to load read receipts:', error.message);
        return;
      }

      const rows = (data || []) as BadgeReceiptRow[];
      const next = emptyReadState();
      for (const row of rows) {
        const id = String(row.item_id);
        switch (row.item_kind) {
          case 'prayer':
            next.prayers.push(id);
            break;
          case 'prayer_update':
            next.prayerUpdates.push(id);
            break;
          case 'prompt':
            next.prompts.push(id);
            break;
          case 'prompt_update':
            next.promptUpdates.push(id);
            break;
          default: {
            const _exhaustive: never = row.item_kind;
            void _exhaustive;
            break;
          }
        }
      }

      // Union DB with any optimistic local marks not yet visible remotely.
      this.readState = {
        prayers: Array.from(new Set([...next.prayers, ...this.readState.prayers])),
        prayerUpdates: Array.from(
          new Set([...next.prayerUpdates, ...this.readState.prayerUpdates])
        ),
        prompts: Array.from(new Set([...next.prompts, ...this.readState.prompts])),
        promptUpdates: Array.from(
          new Set([...next.promptUpdates, ...this.readState.promptUpdates])
        ),
      };
      this.persistReadStateLocally();
    } catch (error) {
      console.warn('[Badge] Failed to load read receipts:', error);
    }
  }

  private async upsertReceiptsToDatabase(
    receipts: BadgeReceiptRow[]
  ): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const email = this.getActiveUserEmail();
    if (!tenantId || !email || receipts.length === 0) {
      return;
    }

    const valid = receipts.filter(
      (r) => r.item_id && UUID_RE.test(r.item_id)
    );
    if (valid.length === 0) {
      return;
    }

    const run = async () => {
      const chunkSize = 200;
      for (let i = 0; i < valid.length; i += chunkSize) {
        const chunk = valid.slice(i, i + chunkSize);
        const { error } = await this.supabase.client.rpc(
          'upsert_badge_read_receipts',
          {
            p_tenant_id: tenantId,
            p_item_kinds: chunk.map((r) => r.item_kind),
            p_item_ids: chunk.map((r) => r.item_id),
            p_user_email: email,
          }
        );
        if (error) {
          console.warn('[Badge] Failed to upsert read receipts:', error.message);
        }
      }
    };

    // Serialize writes so bulk enable + rapid taps don't race.
    this.syncInFlight = (this.syncInFlight ?? Promise.resolve())
      .then(run)
      .catch((error) => {
        console.warn('[Badge] Upsert queue failed:', error);
      });
    await this.syncInFlight;
  }

  private updateBadgeCount(type: 'prayers' | 'prompts'): void {
    const count = this.calculateBadgeCount(type);
    const subject = this.badgeCountSubject$.get(type);
    if (subject) {
      subject.next(count);
    }
  }

  private updateStatusBadgeCount(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): void {
    if (!status || type !== 'prayers') return;

    const key = `${type}_${status}`;
    const count = this.calculateBadgeCount(type, status);
    const subject = this.statusBadgeCountSubject$.get(key);
    if (subject) {
      subject.next(count);
    }
  }
}
