import { Injectable, Injector } from '@angular/core';
import { merge, type Observable } from 'rxjs';
import { resolveAppIconBadgeCount } from '../lib/in-app-prayer-badge-count';
import { attachBadgeServiceLifecycle } from '../lib/badge-lifecycle';
import { GroupPrayerBadgeService } from './group-prayer-badge.service';
import {
  BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS,
  INDIVIDUAL_BADGE_SUBJECT_CAP,
  TenantInAppBadgeService,
} from './tenant-in-app-badge.service';

export {
  BADGE_FOREGROUND_RECEIPT_REVALIDATE_MS,
  INDIVIDUAL_BADGE_SUBJECT_CAP,
};

/**
 * Facade for in-app unread badges: tenant prayers/prompts plus group prayers.
 * Read receipts sync via Supabase; see TenantInAppBadgeService and GroupPrayerBadgeService.
 */
@Injectable({
  providedIn: 'root',
})
export class BadgeService {
  private groupPrayerBadges: GroupPrayerBadgeService | null = null;

  constructor(
    private injector: Injector,
    private readonly tenantBadges: TenantInAppBadgeService
  ) {
    attachBadgeServiceLifecycle({
      injector: this.injector,
      tenantBadges: this.tenantBadges,
      clearSessionBadgeState: () => this.clearSessionBadgeState(),
      reloadReadStateFromSources: () => this.reloadReadStateFromSources(),
      refreshReadStateOnForeground: () => this.refreshReadStateOnForeground(),
      ensureAllTenantInAppBadgeCaches: () =>
        this.ensureAllTenantInAppBadgeCaches(),
      onScopedBadgeReadStorageKey: (key) => {
        const scopedKey =
          this.tenantBadges.getScopedReadCacheKeyForActiveUser();
        if (scopedKey && key === scopedKey) {
          this.tenantBadges.applyLocalCacheToMemory();
          this.refreshBadgeCounts();
        }
      },
      onGroupBadgeReadStorageKey: (key) =>
        this.getGroupPrayerBadges().applyLocalCacheFromStorageEvent(key),
      onMemberPrayerGroupIdsStorageKey: (key) =>
        this.getGroupPrayerBadges().applyMemberGroupIdsFromStorageEvent(key),
      refreshBadgeCounts: () => this.refreshBadgeCounts(),
    });
  }

  private getGroupPrayerBadges(): GroupPrayerBadgeService {
    if (!this.groupPrayerBadges) {
      this.groupPrayerBadges = this.injector.get(GroupPrayerBadgeService);
    }
    return this.groupPrayerBadges;
  }

  private async refreshReadStateOnForeground(): Promise<void> {
    await this.tenantBadges.refreshReadStateOnForeground();
    const groupBadges = this.getGroupPrayerBadges();
    groupBadges.applyLocalCacheToMemory();
    await groupBadges.reloadFromDatabase();
    this.refreshBadgeCounts();
  }

  private async reloadReadStateFromSources(): Promise<void> {
    await this.tenantBadges.reloadReadStateFromSources();
    const groupBadges = this.getGroupPrayerBadges();
    groupBadges.applyLocalCacheToMemory();
    await groupBadges.reloadFromDatabase();
    this.refreshBadgeCounts();
  }

  private clearSessionBadgeState(): void {
    this.tenantBadges.clearSessionBadgeState();
    this.getGroupPrayerBadges().clearSessionBadgeState();
  }

  getUpdateBadgesChanged$(): Observable<void> {
    return merge(
      this.tenantBadges.getUpdateBadgesChanged$(),
      this.getGroupPrayerBadges().getUpdateBadgesChanged$()
    );
  }

  getBadgeFunctionalityEnabled$(): Observable<boolean> {
    return this.tenantBadges.getBadgeFunctionalityEnabled$();
  }

  getPrayerBadgesChanged$(_status: 'current' | 'answered'): Observable<void> {
    return this.tenantBadges.getUpdateBadgesChanged$();
  }

  getViewerEmailForBadges(): string | null {
    return this.tenantBadges.getViewerEmailForBadges();
  }

  markPrayerAsRead(prayerId: string): void {
    this.tenantBadges.markPrayerAsRead(prayerId);
  }

  markGroupPrayerAsRead(prayerId: string, groupId: string): void {
    this.getGroupPrayerBadges().markGroupPrayerAsRead(prayerId, groupId);
  }

  markGroupUpdateAsRead(updateId: string, groupId: string): void {
    this.getGroupPrayerBadges().markGroupUpdateAsRead(updateId, groupId);
  }

  isGroupPrayerUnread(prayerId: string): boolean {
    return this.getGroupPrayerBadges().isGroupPrayerUnread(prayerId);
  }

  isGroupUpdateUnread(updateId: string): boolean {
    return this.getGroupPrayerBadges().isGroupUpdateUnread(updateId);
  }

  getGroupBadgeCount$(
    status?: 'current' | 'answered'
  ): Observable<number> {
    return this.getGroupPrayerBadges().getBadgeCount$(status);
  }

  getGroupBadgeCountForGroup$(groupId: string): Observable<number> {
    return this.getGroupPrayerBadges().getBadgeCountForGroup$(groupId);
  }

  markAllGroupPrayersRead(): void {
    this.getGroupPrayerBadges().markAllGroupPrayersRead();
  }

  markPromptAsRead(promptId: string): void {
    this.tenantBadges.markPromptAsRead(promptId);
  }

  markUpdateAsRead(
    updateId: string,
    itemId: string,
    type: 'prayers' | 'prompts'
  ): void {
    this.tenantBadges.markUpdateAsRead(updateId, itemId, type);
  }

  markAllCachedItemsAsRead(): void {
    const groupBadges = this.getGroupPrayerBadges();
    const hasContent =
      this.tenantBadges.hasCachedTenantBadgeContent() ||
      groupBadges.hasCachedGroupPrayers();
    if (!hasContent) {
      this.tenantBadges.setPendingSeedAllAsRead(true);
      this.tenantBadges.persistPendingSeedFlag(true);
      return;
    }
    this.tenantBadges.setPendingSeedAllAsRead(false);
    this.tenantBadges.persistPendingSeedFlag(false);
    this.tenantBadges.markAllAsRead('prayers');
    this.tenantBadges.markAllAsRead('prompts');
    groupBadges.markAllCachedGroupPrayersAsRead();
  }

  markAllAsRead(type: 'prayers' | 'prompts'): void {
    this.tenantBadges.markAllAsRead(type);
  }

  markAllAsReadByStatus(
    type: 'prayers' | 'prompts',
    status: 'current' | 'answered'
  ): void {
    this.tenantBadges.markAllAsReadByStatus(type, status);
  }

  markAllAsReadByPromptType(promptType: string): void {
    this.tenantBadges.markAllAsReadByPromptType(promptType);
  }

  markAllGroupPrayersReadByStatus(
    status: 'current' | 'answered',
    groupId?: string
  ): void {
    this.getGroupPrayerBadges().markAllGroupPrayersReadByStatus(status, groupId);
  }

  getBadgeCount$(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): Observable<number> {
    return this.tenantBadges.getBadgeCount$(type, status);
  }

  hasIndividualBadge$(
    type: 'prayers' | 'prompts',
    id: string
  ): Observable<boolean> {
    return this.tenantBadges.hasIndividualBadge$(type, id);
  }

  getUnreadIds(type: 'prayers' | 'prompts'): string[] {
    return this.tenantBadges.getUnreadIds(type);
  }

  getAllTenantDisplayedBadgeCount(): number {
    const tenantTotal = this.tenantBadges.sumAllTenantDisplayedBadgeCount();
    const groupTotal = this.getGroupPrayerBadges().getDisplayedBadgeCount();
    return resolveAppIconBadgeCount({
      badgesEnabled: this.tenantBadges.isBadgeFunctionalityEnabled(),
      allTenantDisplayedCount: tenantTotal + groupTotal,
    });
  }

  async ensureAllTenantInAppBadgeCaches(): Promise<void> {
    await this.tenantBadges.ensureAllTenantInAppBadgeCaches();
  }

  isUpdateUnread(updateId: string): boolean {
    return this.tenantBadges.isUpdateUnread(updateId);
  }

  isPrayerUnread(prayerId: string): boolean {
    return this.tenantBadges.isPrayerUnread(prayerId);
  }

  isPromptUnread(promptId: string): boolean {
    return this.tenantBadges.isPromptUnread(promptId);
  }

  refreshBadgeCounts(): void {
    this.maybeSeedPendingMarkAll();
    this.tenantBadges.refreshBadgeCounts();
    this.getGroupPrayerBadges().refreshBadgeCounts();
  }

  private maybeSeedPendingMarkAll(): void {
    const groupBadges = this.getGroupPrayerBadges();
    this.tenantBadges.syncPendingSeedFlagFromStorage();
    if (!this.tenantBadges.hasPendingSeedAllAsRead()) {
      return;
    }
    if (
      !this.tenantBadges.hasCachedTenantBadgeContent() &&
      !groupBadges.hasCachedGroupPrayers()
    ) {
      return;
    }
    this.tenantBadges.setPendingSeedAllAsRead(false);
    this.tenantBadges.persistPendingSeedFlag(false);
    this.tenantBadges.markAllAsRead('prayers');
    this.tenantBadges.markAllAsRead('prompts');
    groupBadges.markAllCachedGroupPrayersAsRead();
  }

  checkIndividualBadge(type: 'prayers' | 'prompts', id: string): boolean {
    return this.tenantBadges.checkIndividualBadge(type, id);
  }
}
