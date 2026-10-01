import { fromEvent, type Subscription } from 'rxjs';
import { APP_BECAME_VISIBLE_EVENT } from './app-foreground';
import { groupPrayersCacheKey } from './prayer-tenant';
import { fetchGroupPrayersByGroupIds } from './prayer-group-prayer-query';
import { PrayerGroupInternalState } from './prayer-group-internal.state';
import {
  notifyGroupPrayerAddedEmail,
  notifyGroupPrayerUpdateEmail,
  resolveGroupNotificationContext,
} from './prayer-group-notifications';
import {
  prayerGroupErrorMessage,
  type PrayerGroupHostBridge,
  type PrayerGroupOpsDeps,
} from './prayer-group-ops-deps';
import type { PrayerGroupCatalogOps } from './prayer-group-catalog.ops';
import type { PrayerRequest } from './prayer-types';
import type { PrayerFormSubmitPayload } from './prayer-form-submit';
import {
  scheduleDebouncedResumeRefresh,
  shouldSchedulePrayerResumeRefresh,
} from './prayer-service-resume';
import { PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS } from './prayer-service-constants';

const GROUP_PRAYERS_CACHE_TTL_MS = 20 * 60 * 1000;

export class PrayerGroupPrayersOps {
  private resumeListenerSubscriptions: Subscription[] = [];

  constructor(
    private readonly state: PrayerGroupInternalState,
    private readonly deps: PrayerGroupOpsDeps,
    private readonly catalog: PrayerGroupCatalogOps,
    private readonly host: PrayerGroupHostBridge
  ) {}

  setupResumeListeners(): void {
    this.resumeListenerSubscriptions.push(
      fromEvent(window, APP_BECAME_VISIBLE_EVENT).subscribe(() => {
        if (shouldSchedulePrayerResumeRefresh()) {
          this.scheduleResumeRefresh();
        }
      })
    );
  }

  getGroupPrayers(): PrayerRequest[] {
    return this.state.prayersSubject.value;
  }

  getGroupPrayerCount(groupId: string): number {
    return this.state.prayerCountsSubject.value.get(groupId) ?? 0;
  }

  getAllCachedGroupPrayers(): PrayerRequest[] {
    const all: PrayerRequest[] = [];
    for (const group of this.state.groupsSubject.value) {
      const cached =
        this.getCachedGroupPrayers(group.id) ??
        this.getStaleGroupPrayers(group.id);
      if (!cached?.length) {
        continue;
      }
      const ordered = [...cached].sort((a, b) => {
        const aTime = Date.parse(a.date_requested) || 0;
        const bTime = Date.parse(b.date_requested) || 0;
        return bTime - aTime;
      });
      all.push(...ordered);
    }
    return all;
  }

  onGroupDeleted(groupId: string): void {
    if (this.state.prayersSubject.value.some((prayer) => prayer.group_id === groupId)) {
      this.state.prayersSubject.next([]);
    }
    this.invalidateGroupPrayersCache(groupId);
  }

  async hydrateGroupPrayers(options: {
    force: boolean;
    focusGroupId?: string | null;
  }): Promise<void> {
    if (options.focusGroupId) {
      this.state.activeGroupId = options.focusGroupId;
    }

    if (!this.deps.connectivity.isOnline()) {
      this.publishFocusedGroupFromCache();
      return;
    }

    try {
      const groups = options.force
        ? await this.catalog.loadMyGroups()
        : this.catalog.getGroups();
      const groupIds = [
        ...new Set(groups.map((group) => group.id).filter((id) => id.length > 0)),
      ];
      if (groupIds.length === 0) {
        return;
      }

      const idsToFetch = options.force
        ? groupIds
        : groupIds.filter((id) => !this.getCachedGroupPrayers(id));
      if (idsToFetch.length > 0) {
        await this.writeFetchedGroupPrayers(idsToFetch);
      }
      for (const groupId of groupIds) {
        this.syncGroupPrayerCountFromCache(groupId);
      }
      if (this.state.activeGroupId && !idsToFetch.includes(this.state.activeGroupId)) {
        this.publishFocusedGroupFromCache();
      }
    } catch (error) {
      console.error('[PrayerGroup] hydrateGroupPrayers failed:', error);
    }
  }

  async loadGroupPrayers(
    groupId: string | null,
    silentRefresh = false
  ): Promise<PrayerRequest[]> {
    if (!groupId) {
      this.state.activeGroupId = null;
      this.state.prayersSubject.next([]);
      return [];
    }

    const cached =
      this.getCachedGroupPrayers(groupId) ??
      (!this.deps.connectivity.isOnline()
        ? this.getStaleGroupPrayers(groupId)
        : null);

    if (cached) {
      this.state.activeGroupId = groupId;
      this.state.prayersSubject.next(cached);
      this.publishGroupPrayerCount(groupId, cached.length);
      if (silentRefresh || !this.deps.connectivity.isOnline()) {
        return cached;
      }
    } else if (this.state.activeGroupId !== groupId) {
      this.state.activeGroupId = groupId;
      this.state.prayersSubject.next([]);
    }

    if (!cached) {
      this.state.loadingPrayersSubject.next(true);
    }

    if (!this.deps.connectivity.isOnline()) {
      this.state.loadingPrayersSubject.next(false);
      return this.state.prayersSubject.value;
    }

    try {
      const grouped = await this.writeFetchedGroupPrayers([groupId]);
      const prayers = grouped.get(groupId) ?? [];
      this.state.activeGroupId = groupId;
      this.state.prayersSubject.next(prayers);
      return prayers;
    } catch (error) {
      console.error('[PrayerGroup] loadGroupPrayers failed:', error);
      if (!cached) {
        this.state.prayersSubject.next([]);
      }
      return this.state.prayersSubject.value;
    } finally {
      this.state.loadingPrayersSubject.next(false);
    }
  }

  async loadGroupPrayersForPrint(groupId: string): Promise<PrayerRequest[]> {
    if (!this.deps.connectivity.isOnline()) {
      return (
        this.getCachedGroupPrayers(groupId) ??
        this.getStaleGroupPrayers(groupId) ??
        []
      );
    }

    try {
      const grouped = await fetchGroupPrayersByGroupIds(
        this.deps.supabase.client,
        [groupId]
      );
      const prayers = grouped.get(groupId) ?? [];
      this.setCachedGroupPrayers(groupId, prayers);
      if (this.state.activeGroupId === groupId) {
        this.state.prayersSubject.next(prayers);
      }
      return prayers;
    } catch (error) {
      console.error('[PrayerGroup] loadGroupPrayersForPrint failed:', error);
      return (
        this.getCachedGroupPrayers(groupId) ??
        this.getStaleGroupPrayers(groupId) ??
        []
      );
    }
  }

  async addGroupPrayer(
    groupId: string,
    payload: PrayerFormSubmitPayload
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('add a group prayer')) {
      return false;
    }
    try {
      const { data: inserted, error } = await this.deps.supabase.client
        .from('group_prayers')
        .insert({
          group_id: groupId,
          title: payload.title,
          description: payload.description,
          prayer_for: payload.prayer_for,
          requester: payload.requester,
          email: payload.email,
          is_anonymous: payload.is_anonymous,
          status: 'current',
        })
        .select('id')
        .single();
      if (error) {
        throw error;
      }
      await this.host.loadGroupPrayers(groupId);
      this.deps.toast.success('Group prayer added');
      void this.notifyGroupPrayerAdded(groupId, payload, inserted.id);
      return true;
    } catch (error) {
      console.error('[PrayerGroup] addGroupPrayer failed:', error);
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to add group prayer'));
      return false;
    }
  }

  async addGroupPrayerUpdate(
    prayerId: string,
    content: string,
    author: string,
    authorEmail: string,
    markAsAnswered = false,
    groupIdHint?: string | null
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('add a group prayer update')) {
      return false;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      this.deps.toast.error('Update content is required');
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client.from('group_prayer_updates').insert({
        group_prayer_id: prayerId,
        content: trimmed,
        author,
        author_email: authorEmail,
        mark_as_answered: markAsAnswered,
      });
      if (error) {
        throw error;
      }
      if (markAsAnswered) {
        await this.deps.supabase.client
          .from('group_prayers')
          .update({
            status: 'answered',
            date_answered: new Date().toISOString(),
          })
          .eq('id', prayerId);
      }
      const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
      if (groupId) {
        await this.host.loadGroupPrayers(groupId);
      }
      const prayer = groupId
        ? (this.getCachedGroupPrayers(groupId) ??
            this.getStaleGroupPrayers(groupId))?.find((row) => row.id === prayerId) ??
          this.state.prayersSubject.value.find((row) => row.id === prayerId)
        : this.state.prayersSubject.value.find((row) => row.id === prayerId);
      if (prayer?.group_id) {
        void this.notifyGroupPrayerUpdate(
          prayer,
          trimmed,
          author,
          authorEmail,
          markAsAnswered
        );
      }
      this.deps.toast.success('Update added');
      return true;
    } catch (error) {
      console.error('[PrayerGroup] addGroupPrayerUpdate failed:', error);
      this.deps.toast.error('Failed to add update');
      return false;
    }
  }

  async setGroupPrayerAnswered(
    prayerId: string,
    answered: boolean,
    groupIdHint?: string | null
  ): Promise<boolean> {
    const action = answered
      ? 'mark a group prayer answered'
      : 'move a group prayer back to current';
    if (!this.deps.connectivity.requireOnline(action)) {
      return false;
    }

    const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
    if (!groupId) {
      this.deps.toast.error('Failed to update prayer');
      return false;
    }

    const status = answered ? 'answered' : 'current';
    const dateAnswered = answered ? new Date().toISOString() : null;

    try {
      const { error } = await this.deps.supabase.client
        .from('group_prayers')
        .update({
          status,
          date_answered: dateAnswered,
        })
        .eq('id', prayerId);
      if (error) {
        throw error;
      }
      this.patchCachedGroupPrayer(groupId, prayerId, {
        status,
        date_answered: dateAnswered,
      });
      this.deps.toast.success(
        answered ? 'Marked as answered' : 'Moved back to current'
      );
      return true;
    } catch (error) {
      console.error('[PrayerGroup] setGroupPrayerAnswered failed:', error);
      this.deps.toast.error('Failed to update prayer');
      return false;
    }
  }

  async updateGroupPrayer(
    prayerId: string,
    fields: { prayer_for: string; description: string },
    groupIdHint?: string | null
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('update a group prayer')) {
      return false;
    }
    const prayerFor = fields.prayer_for.trim();
    if (!prayerFor) {
      this.deps.toast.error('Prayer for is required');
      return false;
    }
    const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
    if (!groupId) {
      this.deps.toast.error('Failed to update prayer');
      return false;
    }
    const title = `Prayer for ${prayerFor}`;
    try {
      const { error } = await this.deps.supabase.client
        .from('group_prayers')
        .update({
          prayer_for: prayerFor,
          description: fields.description,
          title,
        })
        .eq('id', prayerId);
      if (error) {
        throw error;
      }
      this.patchCachedGroupPrayer(groupId, prayerId, {
        prayer_for: prayerFor,
        description: fields.description,
        title,
      });
      this.deps.toast.success('Prayer updated');
      return true;
    } catch (error) {
      console.error('[PrayerGroup] updateGroupPrayer failed:', error);
      this.deps.toast.error('Failed to update prayer');
      return false;
    }
  }

  async updateGroupPrayerUpdate(
    updateId: string,
    prayerId: string,
    content: string,
    groupIdHint?: string | null
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('update a group prayer update')) {
      return false;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      this.deps.toast.error('Update content is required');
      return false;
    }
    const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
    if (!groupId) {
      this.deps.toast.error('Failed to update prayer update');
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client
        .from('group_prayer_updates')
        .update({ content: trimmed })
        .eq('id', updateId);
      if (error) {
        throw error;
      }
      this.patchCachedGroupPrayerUpdate(groupId, prayerId, updateId, trimmed);
      this.deps.toast.success('Prayer update saved');
      return true;
    } catch (error) {
      console.error('[PrayerGroup] updateGroupPrayerUpdate failed:', error);
      this.deps.toast.error('Failed to update prayer update');
      return false;
    }
  }

  async deleteGroupPrayer(
    prayerId: string,
    groupIdHint?: string | null
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('delete a group prayer')) {
      return false;
    }
    const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
    try {
      const { error } = await this.deps.supabase.client
        .from('group_prayers')
        .delete()
        .eq('id', prayerId);
      if (error) {
        throw error;
      }
      if (groupId) {
        await this.host.loadGroupPrayers(groupId);
      }
      this.deps.toast.success('Prayer deleted');
      return true;
    } catch {
      this.deps.toast.error('Failed to delete prayer');
      return false;
    }
  }

  async deleteGroupPrayerUpdate(
    updateId: string,
    prayerId: string,
    groupIdHint?: string | null
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('delete a group prayer update')) {
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client
        .from('group_prayer_updates')
        .delete()
        .eq('id', updateId);
      if (error) {
        throw error;
      }
      const groupId = this.resolveGroupIdForPrayer(prayerId, groupIdHint);
      if (groupId) {
        await this.host.loadGroupPrayers(groupId);
      }
      return true;
    } catch {
      this.deps.toast.error('Failed to delete update');
      return false;
    }
  }

  private scheduleResumeRefresh(): void {
    this.state.resumeRefreshTimeoutId = scheduleDebouncedResumeRefresh(
      this.state.resumeRefreshTimeoutId,
      PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS,
      () => {
        this.state.resumeRefreshTimeoutId = null;
        void this.host.hydrateGroupPrayers({ force: false });
      }
    );
  }

  private publishFocusedGroupFromCache(): void {
    if (!this.state.activeGroupId) {
      return;
    }
    const cached = this.getCachedGroupPrayers(this.state.activeGroupId);
    if (cached) {
      this.state.prayersSubject.next(cached);
    }
  }

  private async writeFetchedGroupPrayers(
    groupIds: string[]
  ): Promise<Map<string, PrayerRequest[]>> {
    const grouped = await fetchGroupPrayersByGroupIds(
      this.deps.supabase.client,
      groupIds
    );
    for (const groupId of groupIds) {
      const prayers = grouped.get(groupId) ?? [];
      this.setCachedGroupPrayers(groupId, prayers);
      if (this.state.activeGroupId === groupId) {
        this.state.prayersSubject.next(prayers);
      }
    }
    return grouped;
  }

  private getCachedGroupPrayers(groupId: string): PrayerRequest[] | null {
    return this.deps.cache.get<PrayerRequest[]>(groupPrayersCacheKey(groupId));
  }

  private getStaleGroupPrayers(groupId: string): PrayerRequest[] | null {
    return this.deps.cache.getStale<PrayerRequest[]>(groupPrayersCacheKey(groupId));
  }

  private setCachedGroupPrayers(groupId: string, prayers: PrayerRequest[]): void {
    this.deps.cache.set(
      groupPrayersCacheKey(groupId),
      prayers,
      GROUP_PRAYERS_CACHE_TTL_MS
    );
    this.publishGroupPrayerCount(groupId, prayers.length);
    this.deps.refreshGroupBadgeCounts();
  }

  private invalidateGroupPrayersCache(groupId: string): void {
    this.deps.cache.invalidate(groupPrayersCacheKey(groupId));
    this.publishGroupPrayerCount(groupId, null);
    this.deps.refreshGroupBadgeCounts();
  }

  private syncGroupPrayerCountFromCache(groupId: string): void {
    const cached =
      this.getCachedGroupPrayers(groupId) ?? this.getStaleGroupPrayers(groupId);
    if (cached) {
      this.publishGroupPrayerCount(groupId, cached.length);
    }
  }

  private patchCachedGroupPrayer(
    groupId: string,
    prayerId: string,
    patch: Partial<PrayerRequest>
  ): void {
    const cached =
      this.getCachedGroupPrayers(groupId) ?? this.getStaleGroupPrayers(groupId);
    if (cached) {
      this.setCachedGroupPrayers(
        groupId,
        cached.map((prayer) =>
          prayer.id === prayerId ? { ...prayer, ...patch } : prayer
        )
      );
    }

    if (this.state.activeGroupId === groupId) {
      this.publishFocusedGroupFromCache();
    }
  }

  private patchCachedGroupPrayerUpdate(
    groupId: string,
    prayerId: string,
    updateId: string,
    content: string
  ): void {
    const cached =
      this.getCachedGroupPrayers(groupId) ?? this.getStaleGroupPrayers(groupId);
    const prayer = cached?.find((row) => row.id === prayerId);
    if (!prayer) {
      return;
    }
    this.patchCachedGroupPrayer(groupId, prayerId, {
      updates: (prayer.updates ?? []).map((update) =>
        update.id === updateId ? { ...update, content } : update
      ),
    });
  }

  private publishGroupPrayerCount(groupId: string, count: number | null): void {
    const next = new Map(this.state.prayerCountsSubject.value);
    if (count === null) {
      next.delete(groupId);
    } else {
      next.set(groupId, count);
    }
    this.state.prayerCountsSubject.next(next);
  }

  private resolveGroupIdForPrayer(
    prayerId: string,
    groupIdHint?: string | null
  ): string | null {
    if (groupIdHint) {
      return groupIdHint;
    }
    const fromActive = this.state.prayersSubject.value.find(
      (prayer) => prayer.id === prayerId
    )?.group_id;
    if (fromActive) {
      return fromActive;
    }
    for (const group of this.state.groupsSubject.value) {
      const cached =
        this.getCachedGroupPrayers(group.id) ??
        this.getStaleGroupPrayers(group.id);
      if (cached?.some((prayer) => prayer.id === prayerId)) {
        return group.id;
      }
    }
    return null;
  }

  private async notifyGroupPrayerAdded(
    groupId: string,
    payload: PrayerFormSubmitPayload,
    prayerId: string
  ): Promise<void> {
    const group = this.state.groupsSubject.value.find((row) => row.id === groupId);
    if (!group) {
      return;
    }
    const context = await resolveGroupNotificationContext(
      this.deps.supabase,
      group,
      (id) => this.catalog.loadGroupMembers(id)
    );
    if (!context) {
      return;
    }
    await notifyGroupPrayerAddedEmail(
      this.deps.emailNotification,
      context,
      groupId,
      payload,
      prayerId
    );
  }

  private async notifyGroupPrayerUpdate(
    prayer: PrayerRequest,
    content: string,
    author: string,
    authorEmail: string,
    markedAsAnswered: boolean
  ): Promise<void> {
    const groupId = prayer.group_id;
    if (!groupId) {
      return;
    }
    const group = this.state.groupsSubject.value.find((row) => row.id === groupId);
    if (!group) {
      return;
    }
    const context = await resolveGroupNotificationContext(
      this.deps.supabase,
      group,
      (id) => this.catalog.loadGroupMembers(id)
    );
    if (!context) {
      return;
    }
    await notifyGroupPrayerUpdateEmail(
      this.deps.emailNotification,
      context,
      prayer,
      content,
      author,
      authorEmail,
      markedAsAnswered
    );
  }
}
