import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import {
  countDisplayedGroupBadgesAcrossCaches,
  emptyGroupBadgeReadState,
  groupBadgeReadCacheKey,
  parseGroupBadgeReadState,
  readMemberPrayerGroupIdsFromStorage,
  resolveGroupBadgeTargetGroupIds,
  receiptsToGroupReadState,
  unionGroupBadgeReadState,
  type GroupBadgeReadState,
  type GroupBadgeReceiptRow,
} from '../lib/group-in-app-badge-count';
import { parseCachedBadgeItems, isOwnBadgePrayerItem, isOwnBadgeUpdate, type InAppBadgeCachedItem } from '../lib/in-app-prayer-badge-count';
import { groupPrayersCacheKey } from '../lib/prayer-tenant';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CachedGroupItem extends InAppBadgeCachedItem {
  status?: 'current' | 'answered';
}

@Injectable({ providedIn: 'root' })
export class GroupPrayerBadgeService {
  private readState: GroupBadgeReadState = emptyGroupBadgeReadState();
  private updateBadgesChanged$ = new Subject<void>();
  private badgeCountSubject$ = new Map<string, BehaviorSubject<number>>();
  private userSession: UserSessionService | null = null;
  private syncInFlight: Promise<void> | null = null;

  constructor(
    private supabase: SupabaseService,
    private injector: Injector
  ) {
    this.badgeCountSubject$.set('groups', new BehaviorSubject<number>(0));
    this.badgeCountSubject$.set('groups_current', new BehaviorSubject<number>(0));
    this.badgeCountSubject$.set('groups_answered', new BehaviorSubject<number>(0));
  }

  getUpdateBadgesChanged$(): Observable<void> {
    return this.updateBadgesChanged$.asObservable();
  }

  getDisplayedBadgeCount(): number {
    return this.calculateBadgeCount();
  }

  getBadgeCount$(status?: 'current' | 'answered'): Observable<number> {
    const key = status ? `groups_${status}` : 'groups';
    let subject = this.badgeCountSubject$.get(key);
    if (!subject) {
      subject = new BehaviorSubject<number>(0);
      this.badgeCountSubject$.set(key, subject);
    }
    const count = this.calculateBadgeCount(status);
    subject.next(count);
    return subject.asObservable();
  }

  getBadgeCountForGroup$(groupId: string): Observable<number> {
    const key = `group_${groupId}`;
    let subject = this.badgeCountSubject$.get(key);
    if (!subject) {
      subject = new BehaviorSubject<number>(0);
      this.badgeCountSubject$.set(key, subject);
    }
    subject.next(this.calculateBadgeCount(undefined, groupId));
    return subject.asObservable();
  }

  isGroupPrayerUnread(prayerId: string): boolean {
    const viewerEmail = this.getActiveUserEmail();
    const item = this.findCachedGroupPrayer(prayerId);
    if (item && isOwnBadgePrayerItem(item, viewerEmail)) {
      return false;
    }
    return !this.readState.groupPrayers.includes(prayerId);
  }

  isGroupUpdateUnread(updateId: string): boolean {
    const viewerEmail = this.getActiveUserEmail();
    const found = this.findCachedGroupUpdate(updateId);
    if (found && isOwnBadgeUpdate(found.update, viewerEmail)) {
      return false;
    }
    return !this.readState.groupPrayerUpdates.includes(updateId);
  }

  markGroupPrayerAsRead(prayerId: string, groupId: string): void {
    const receipts: GroupBadgeReceiptRow[] = [];
    const added = this.addIdsToReadState('groupPrayers', [prayerId]);
    if (added.length > 0) {
      receipts.push({
        item_kind: 'group_prayer',
        item_id: prayerId,
        group_id: groupId,
      });
    }
    const updateReceipts = this.markGroupItemUpdatesAsRead(prayerId, groupId);
    receipts.push(...updateReceipts);
    this.persistReadStateLocally();
    void this.upsertReceiptsToDatabase(receipts);
    this.refreshBadgeCounts();
    this.updateBadgesChanged$.next();
  }

  markGroupUpdateAsRead(updateId: string, groupId: string): void {
    const added = this.addIdsToReadState('groupPrayerUpdates', [updateId]);
    if (added.length > 0) {
      this.persistReadStateLocally();
      void this.upsertReceiptsToDatabase([
        {
          item_kind: 'group_prayer_update',
          item_id: updateId,
          group_id: groupId,
        },
      ]);
    }
    this.refreshBadgeCounts();
    this.updateBadgesChanged$.next();
  }

  markAllGroupPrayersRead(): void {
    this.markAllGroupPrayersReadByStatus('current');
    this.markAllGroupPrayersReadByStatus('answered');
  }

  markAllGroupPrayersReadByStatus(
    status: 'current' | 'answered',
    groupId?: string
  ): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const targets = this.listGroupIdsForBadges(groupId);

    const receipts: GroupBadgeReceiptRow[] = [];
    for (const gid of targets) {
      const items = this.readCachedItems(gid).filter(
        (item) => item.status === status
      );
      for (const item of items) {
        if (!item.id) {
          continue;
        }
        const added = this.addIdsToReadState('groupPrayers', [item.id]);
        if (added.length > 0) {
          receipts.push({
            item_kind: 'group_prayer',
            item_id: item.id,
            group_id: gid,
          });
        }
        for (const updateId of this.collectUpdateIds([item])) {
          const addedUpdate = this.addIdsToReadState('groupPrayerUpdates', [
            updateId,
          ]);
          if (addedUpdate.length > 0) {
            receipts.push({
              item_kind: 'group_prayer_update',
              item_id: updateId,
              group_id: gid,
            });
          }
        }
      }
    }

    this.persistReadStateLocally();
    void this.upsertReceiptsToDatabase(receipts);
    this.refreshBadgeCounts();
    this.updateBadgesChanged$.next();
  }

  markAllCachedGroupPrayersAsRead(): void {
    if (!this.cacheHasAnyGroupItems()) {
      return;
    }
    this.markAllGroupPrayersRead();
  }

  hasCachedGroupPrayers(): boolean {
    return this.cacheHasAnyGroupItems();
  }

  applyLocalCacheToMemory(): void {
    const email = this.getActiveUserEmail();
    if (!email || typeof localStorage === 'undefined') {
      this.readState = emptyGroupBadgeReadState();
      return;
    }
    this.readState = parseGroupBadgeReadState(
      localStorage.getItem(groupBadgeReadCacheKey(email))
    );
  }

  /** Cross-tab `storage` events for `badge_read_groups:{email}`. */
  applyLocalCacheFromStorageEvent(storageKey: string): boolean {
    const email = this.getActiveUserEmail();
    if (!email || storageKey !== groupBadgeReadCacheKey(email)) {
      return false;
    }
    this.applyLocalCacheToMemory();
    return true;
  }

  async reloadFromDatabase(): Promise<void> {
    const email = this.getActiveUserEmail();
    if (!email) {
      return;
    }
    try {
      const { data, error } = await this.supabase.client.rpc(
        'get_group_badge_read_receipts'
      );
      if (error) {
        console.warn('[GroupBadge] Failed to load read receipts:', error.message);
        return;
      }
      const rows = (data || []) as GroupBadgeReceiptRow[];
      this.readState = unionGroupBadgeReadState(
        this.readState,
        receiptsToGroupReadState(rows)
      );
      this.persistReadStateLocally();
      this.refreshBadgeCounts();
    } catch (error) {
      console.warn('[GroupBadge] Failed to load read receipts:', error);
    }
  }

  refreshBadgeCounts(): void {
    this.badgeCountSubject$.forEach((subject, key) => {
      if (key === 'groups') {
        subject.next(this.calculateBadgeCount());
      } else if (key === 'groups_current') {
        subject.next(this.calculateBadgeCount('current'));
      } else if (key === 'groups_answered') {
        subject.next(this.calculateBadgeCount('answered'));
      } else if (key.startsWith('group_')) {
        const groupId = key.slice('group_'.length);
        subject.next(this.calculateBadgeCount(undefined, groupId));
      }
    });
    this.updateBadgesChanged$.next();
  }

  private calculateBadgeCount(
    status?: 'current' | 'answered',
    groupId?: string
  ): number {
    if (typeof localStorage === 'undefined') {
      return 0;
    }
    return countDisplayedGroupBadgesAcrossCaches(
      localStorage,
      [],
      this.readState,
      {
        status,
        groupId,
        viewerEmail: this.getActiveUserEmail(),
        memberGroupIds: this.readMemberGroupIdsForBadges(),
      }
    );
  }

  private readMemberGroupIdsForBadges(): string[] | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return readMemberPrayerGroupIdsFromStorage(
      localStorage,
      this.getActiveUserEmail()
    );
  }

  private listGroupIdsForBadges(groupId?: string): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    return resolveGroupBadgeTargetGroupIds(localStorage, {
      groupId,
      memberGroupIds: this.readMemberGroupIdsForBadges(),
    });
  }

  private findCachedGroupPrayer(prayerId: string): CachedGroupItem | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    for (const groupId of this.listGroupIdsForBadges()) {
      const item = this.readCachedItems(groupId).find((row) => row.id === prayerId);
      if (item) {
        return item;
      }
    }
    return null;
  }

  private findCachedGroupUpdate(
    updateId: string
  ): { update: NonNullable<CachedGroupItem['updates']>[number] } | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    for (const groupId of this.listGroupIdsForBadges()) {
      for (const item of this.readCachedItems(groupId)) {
        if (!item.updates?.length) {
          continue;
        }
        const update = item.updates.find((row) => row.id === updateId);
        if (update) {
          return { update };
        }
      }
    }
    return null;
  }

  private readCachedItems(groupId: string): CachedGroupItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    return parseCachedBadgeItems(
      localStorage.getItem(groupPrayersCacheKey(groupId))
    ) as CachedGroupItem[];
  }

  private cacheHasAnyGroupItems(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    for (const groupId of this.listGroupIdsForBadges()) {
      if (this.readCachedItems(groupId).length > 0) {
        return true;
      }
    }
    return false;
  }

  private markGroupItemUpdatesAsRead(
    prayerId: string,
    groupId: string
  ): GroupBadgeReceiptRow[] {
    const receipts: GroupBadgeReceiptRow[] = [];
    const item = this.readCachedItems(groupId).find((row) => row.id === prayerId);
    if (!item?.updates?.length) {
      return receipts;
    }
    for (const update of item.updates) {
      if (!update.id) {
        continue;
      }
      const added = this.addIdsToReadState('groupPrayerUpdates', [update.id]);
      if (added.length > 0) {
        receipts.push({
          item_kind: 'group_prayer_update',
          item_id: update.id,
          group_id: groupId,
        });
      }
    }
    return receipts;
  }

  private collectUpdateIds(items: CachedGroupItem[]): string[] {
    const ids: string[] = [];
    for (const item of items) {
      if (!item.updates?.length) {
        continue;
      }
      for (const update of item.updates) {
        if (update.id && !ids.includes(update.id)) {
          ids.push(update.id);
        }
      }
    }
    return ids;
  }

  private addIdsToReadState(
    field: keyof GroupBadgeReadState,
    ids: string[]
  ): string[] {
    const existing = new Set(this.readState[field]);
    const added: string[] = [];
    for (const id of ids) {
      if (!existing.has(id)) {
        existing.add(id);
        added.push(id);
      }
    }
    if (added.length > 0) {
      this.readState = {
        ...this.readState,
        [field]: Array.from(existing),
      };
    }
    return added;
  }

  private persistReadStateLocally(): void {
    const email = this.getActiveUserEmail();
    if (!email || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        groupBadgeReadCacheKey(email),
        JSON.stringify(this.readState)
      );
    } catch {
      // ignore
    }
  }

  private async upsertReceiptsToDatabase(
    receipts: GroupBadgeReceiptRow[]
  ): Promise<void> {
    const email = this.getActiveUserEmail();
    if (!email || receipts.length === 0) {
      return;
    }
    const valid = receipts.filter(
      (r) => r.item_id && UUID_RE.test(r.item_id) && r.group_id
    );
    if (valid.length === 0) {
      return;
    }

    const run = async () => {
      const chunkSize = 200;
      for (let i = 0; i < valid.length; i += chunkSize) {
        const chunk = valid.slice(i, i + chunkSize);
        const { error } = await this.supabase.client.rpc(
          'upsert_group_badge_read_receipts',
          {
            p_group_ids: chunk.map((r) => r.group_id),
            p_item_kinds: chunk.map((r) => r.item_kind),
            p_item_ids: chunk.map((r) => r.item_id),
          }
        );
        if (error) {
          console.warn('[GroupBadge] Failed to upsert read receipts:', error.message);
        }
      }
    };

    this.syncInFlight = (this.syncInFlight ?? Promise.resolve())
      .then(run)
      .catch((error) => {
        console.warn('[GroupBadge] Upsert queue failed:', error);
      });
    await this.syncInFlight;
  }

  private getActiveUserEmail(): string | null {
    if (!this.userSession) {
      this.userSession = this.injector.get(UserSessionService);
    }
    const email = (this.userSession.getUserEmail?.() ?? '').trim();
    return email ? email.toLowerCase() : null;
  }
}
