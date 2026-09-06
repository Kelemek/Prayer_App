import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, type Subscription } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';
import { ConnectivityService } from './connectivity.service';
import { ToastService } from './toast.service';
import { UserSessionService } from './user-session.service';
import { EmailNotificationService } from './email-notification.service';
import { CacheService } from './cache.service';
import { groupPrayersCacheKey } from '../lib/prayer-tenant';
import {
  scheduleDebouncedResumeRefresh,
  shouldSchedulePrayerResumeRefresh,
} from '../lib/prayer-service-resume';
import { PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS } from '../lib/prayer-service-constants';
import type { PrayerGroup, PrayerGroupMember, PrayerGroupMembershipProfile } from '../types/prayer-group';
import type { PrayerRequest, PrayerUpdate } from '../lib/prayer-types';
import type { PrayerFormSubmitPayload } from '../lib/prayer-form-submit';

interface GroupPrayerRow {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  prayer_for: string;
  status: 'current' | 'answered';
  requester: string;
  email: string;
  is_anonymous: boolean;
  date_requested: string;
  date_answered: string | null;
  prayed_for_count: number;
  created_at: string;
  updated_at: string;
  group_prayer_updates?: GroupPrayerUpdateRow[] | null;
}

interface GroupPrayerUpdateRow {
  id: string;
  group_prayer_id: string;
  content: string;
  author: string;
  author_email: string;
  mark_as_answered: boolean;
  created_at: string;
}

const GROUP_PRAYERS_SELECT = `
  id,
  group_id,
  title,
  description,
  prayer_for,
  status,
  requester,
  email,
  is_anonymous,
  date_requested,
  date_answered,
  prayed_for_count,
  created_at,
  updated_at,
  group_prayer_updates (
    id,
    group_prayer_id,
    content,
    author,
    author_email,
    mark_as_answered,
    created_at
  )
`;

@Injectable({ providedIn: 'root' })
export class PrayerGroupService {
  private readonly groupsSubject = new BehaviorSubject<PrayerGroup[]>([]);
  private readonly prayersSubject = new BehaviorSubject<PrayerRequest[]>([]);
  private readonly prayerCountsSubject = new BehaviorSubject<
    ReadonlyMap<string, number>
  >(new Map());
  private readonly loadingGroupsSubject = new BehaviorSubject<boolean>(false);
  private readonly loadingPrayersSubject = new BehaviorSubject<boolean>(false);
  private canCreate = false;
  private activeGroupId: string | null = null;
  private resumeRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resumeListenerSubscriptions: Subscription[] = [];

  private static readonly GROUP_PRAYERS_CACHE_TTL_MS = 20 * 60 * 1000;

  readonly groups$ = this.groupsSubject.asObservable();
  readonly prayers$ = this.prayersSubject.asObservable();
  readonly groupPrayerCounts$ = this.prayerCountsSubject.asObservable();
  readonly loadingGroups$ = this.loadingGroupsSubject.asObservable();
  readonly loadingPrayers$ = this.loadingPrayersSubject.asObservable();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly authIdentity: AuthIdentityService,
    private readonly connectivity: ConnectivityService,
    private readonly toast: ToastService,
    private readonly userSession: UserSessionService,
    private readonly emailNotification: EmailNotificationService,
    private readonly cache: CacheService
  ) {
    this.setupResumeListeners();
  }

  getGroups(): PrayerGroup[] {
    return this.groupsSubject.value;
  }

  getGroupPrayers(): PrayerRequest[] {
    return this.prayersSubject.value;
  }

  getGroupPrayerCount(groupId: string): number {
    return this.prayerCountsSubject.value.get(groupId) ?? 0;
  }

  /** Flatten cached prayers in group-chip order; newest first within each group. */
  getAllCachedGroupPrayers(): PrayerRequest[] {
    const all: PrayerRequest[] = [];
    for (const group of this.groupsSubject.value) {
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

  canCreatePrayerGroups(): boolean {
    return this.canCreate;
  }

  canAccessGroupsTab(): boolean {
    return this.canCreate || this.groupsSubject.value.length > 0;
  }

  async refreshCapabilities(): Promise<void> {
    const email = await this.authIdentity.getEmail();
    if (!email) {
      this.canCreate = false;
      return;
    }
    const { data, error } = await this.supabase.client.rpc(
      'can_create_prayer_groups',
      { email_to_check: email }
    );
    if (error) {
      console.error('[PrayerGroup] can_create_prayer_groups failed:', error);
      this.canCreate = false;
      return;
    }
    this.canCreate = data === true;
  }

  async loadMyGroups(): Promise<PrayerGroup[]> {
    this.loadingGroupsSubject.next(true);
    try {
      await this.refreshCapabilities();
      const email = await this.authIdentity.getEmail();
      if (!email) {
        this.groupsSubject.next([]);
        return [];
      }

      const { data: memberships, error: memberError } = await this.supabase.client
        .from('prayer_group_members')
        .select('group_id, role, is_active, display_order')
        .eq('user_email', email.toLowerCase())
        .eq('is_active', true);
      if (memberError) throw memberError;

      const rows = (memberships ?? []) as {
        group_id: string;
        role: 'owner' | 'member';
        display_order: number;
      }[];
      if (rows.length === 0) {
        this.groupsSubject.next([]);
        return [];
      }

      const ids = rows.map((row) => row.group_id);
      const { data: groups, error: groupsError } = await this.supabase.client
        .from('prayer_groups')
        .select('id, name, created_by_email, created_from_tenant_id, created_at, updated_at')
        .in('id', ids);
      if (groupsError) throw groupsError;

      const roleById = new Map(rows.map((row) => [row.group_id, row.role]));
      const orderById = new Map(rows.map((row) => [row.group_id, row.display_order]));
      const groupById = new Map(
        ((groups ?? []) as PrayerGroup[]).map((group) => [group.id, group])
      );
      const mapped: PrayerGroup[] = [];
      for (const row of rows) {
        const group = groupById.get(row.group_id);
        if (!group) continue;
        mapped.push({
          ...group,
          my_role: roleById.get(group.id),
        });
      }
      mapped.sort((left, right) => {
        const orderLeft = orderById.get(left.id) ?? 0;
        const orderRight = orderById.get(right.id) ?? 0;
        if (orderLeft !== orderRight) {
          return orderLeft - orderRight;
        }
        return (
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
        );
      });
      this.groupsSubject.next(mapped);
      return mapped;
    } catch (error) {
      console.error('[PrayerGroup] loadMyGroups failed:', error);
      this.groupsSubject.next([]);
      return [];
    } finally {
      this.loadingGroupsSubject.next(false);
    }
  }

  async createGroup(name: string): Promise<PrayerGroup | null> {
    if (!this.connectivity.requireOnline('create a group')) {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      this.toast.error('Enter a group name');
      return null;
    }
    try {
      const { data, error } = await this.supabase.client.rpc('create_prayer_group', {
        p_name: trimmed,
      });
      if (error) throw error;
      const groups = await this.loadMyGroups();
      const created = groups.find((group) => group.id === data) ?? null;
      this.toast.success('Group created');
      return created;
    } catch (error) {
      console.error('[PrayerGroup] createGroup failed:', error);
      this.toast.error(this.errorMessage(error, 'Failed to create group'));
      return null;
    }
  }

  async inviteMembers(groupId: string, emails: string[]): Promise<number> {
    if (!this.connectivity.requireOnline('invite group members')) {
      return 0;
    }
    const unique = [
      ...new Set(
        emails
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.includes('@'))
      ),
    ];
    if (unique.length === 0) {
      this.toast.error('Enter at least one valid email address');
      return 0;
    }

    const group = this.groupsSubject.value.find((item) => item.id === groupId);
    const inviterName =
      this.userSession.getCurrentSession()?.fullName?.trim() ||
      (await this.authIdentity.getEmail()) ||
      'A group member';
    let invited = 0;
    for (const email of unique) {
      try {
        const { error } = await this.supabase.client.rpc('invite_prayer_group_member', {
          p_group_id: groupId,
          p_email: email,
        });
        if (error) throw error;
        invited += 1;
        void this.emailNotification.sendGroupInvitation({
          to: email,
          groupName: group?.name ?? 'a prayer group',
          inviterName,
          tenantId: group?.created_from_tenant_id,
        });
      } catch (error) {
        console.error('[PrayerGroup] invite failed for', email, error);
      }
    }
    if (invited > 0) {
      this.toast.success(
        invited === 1 ? 'Invitation sent' : `${invited} invitations sent`
      );
    } else {
      this.toast.error('Could not send invitations');
    }
    return invited;
  }

  async reorderGroups(orderedGroupIds: string[]): Promise<boolean> {
    if (!this.connectivity.requireOnline('reorder groups')) {
      return false;
    }
    if (orderedGroupIds.length === 0) {
      return true;
    }

    const current = this.groupsSubject.value;
    const byId = new Map(current.map((group) => [group.id, group]));
    const reordered = orderedGroupIds
      .map((id) => byId.get(id))
      .filter((group): group is PrayerGroup => group != null);
    if (reordered.length !== orderedGroupIds.length) {
      return false;
    }

    this.groupsSubject.next(reordered);

    try {
      const { error } = await this.supabase.client.rpc('reorder_prayer_groups', {
        p_ordered_group_ids: orderedGroupIds,
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[PrayerGroup] reorderGroups failed:', error);
      await this.loadMyGroups();
      this.toast.error(this.errorMessage(error, 'Failed to reorder groups'));
      return false;
    }
  }

  async renameGroup(groupId: string, name: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('rename a group')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client.rpc('rename_prayer_group', {
        p_group_id: groupId,
        p_name: name.trim(),
      });
      if (error) throw error;
      await this.loadMyGroups();
      this.toast.success('Group renamed');
      return true;
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'Failed to rename group'));
      return false;
    }
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete a group')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client.rpc('delete_prayer_group', {
        p_group_id: groupId,
      });
      if (error) throw error;
      await this.loadMyGroups();
      if (this.prayersSubject.value.some((prayer) => prayer.group_id === groupId)) {
        this.prayersSubject.next([]);
      }
      this.invalidateGroupPrayersCache(groupId);
      this.toast.success('Group deleted');
      return true;
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'Failed to delete group'));
      return false;
    }
  }

  async leaveGroup(groupId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('leave a group')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client.rpc('leave_prayer_group', {
        p_group_id: groupId,
      });
      if (error) throw error;
      await this.loadMyGroups();
      this.toast.success('You left the group');
      return true;
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'Failed to leave group'));
      return false;
    }
  }

  async loadGroupMembers(groupId: string): Promise<PrayerGroupMember[]> {
    try {
      const { data, error } = await this.supabase.client
        .from('prayer_group_members')
        .select(
          'id, group_id, user_email, role, invited_by_email, name, is_active, created_at, updated_at'
        )
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrayerGroupMember[];
    } catch (error) {
      console.error('[PrayerGroup] loadGroupMembers failed:', error);
      return [];
    }
  }

  async removeMember(groupId: string, email: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('remove a group member')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client.rpc('remove_prayer_group_member', {
        p_group_id: groupId,
        p_email: email,
      });
      if (error) throw error;
      this.toast.success('Member removed');
      return true;
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'Failed to remove member'));
      return false;
    }
  }

  async getMembershipProfile(
    email?: string | null
  ): Promise<PrayerGroupMembershipProfile> {
    const userEmail = (email || (await this.authIdentity.getEmail()) || '')
      .toLowerCase()
      .trim();
    if (!userEmail) {
      return { hasMembership: false, name: null };
    }
    const { data, error } = await this.supabase.client
      .from('prayer_group_members')
      .select('name')
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .limit(1);
    if (error) {
      console.error('[PrayerGroup] getMembershipProfile failed:', error);
      return { hasMembership: false, name: null };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { hasMembership: false, name: null };
    }
    const name =
      typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null;
    return { hasMembership: true, name };
  }

  async setMemberName(fullName: string): Promise<boolean> {
    const email = await this.authIdentity.getEmail();
    if (!email) return false;
    const { error } = await this.supabase.client.rpc('set_prayer_group_member_name', {
      p_email: email,
      p_name: fullName.trim(),
    });
    if (error) {
      console.error('[PrayerGroup] setMemberName failed:', error);
      return false;
    }
    return true;
  }

  async hydrateGroupPrayers(options: {
    force: boolean;
    focusGroupId?: string | null;
  }): Promise<void> {
    if (options.focusGroupId) {
      this.activeGroupId = options.focusGroupId;
    }

    if (!this.connectivity.isOnline()) {
      this.publishFocusedGroupFromCache();
      return;
    }

    try {
      const groups = options.force ? await this.loadMyGroups() : this.getGroups();
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
      if (
        this.activeGroupId &&
        !idsToFetch.includes(this.activeGroupId)
      ) {
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
      this.activeGroupId = null;
      this.prayersSubject.next([]);
      return [];
    }

    const cached =
      this.getCachedGroupPrayers(groupId) ??
      (!this.connectivity.isOnline()
        ? this.getStaleGroupPrayers(groupId)
        : null);

    if (cached) {
      this.activeGroupId = groupId;
      this.prayersSubject.next(cached);
      this.publishGroupPrayerCount(groupId, cached.length);
      if (silentRefresh || !this.connectivity.isOnline()) {
        return cached;
      }
    } else if (this.activeGroupId !== groupId) {
      this.activeGroupId = groupId;
      this.prayersSubject.next([]);
    }

    if (!cached) {
      this.loadingPrayersSubject.next(true);
    }

    if (!this.connectivity.isOnline()) {
      this.loadingPrayersSubject.next(false);
      return this.prayersSubject.value;
    }

    try {
      const grouped = await this.writeFetchedGroupPrayers([groupId]);
      const prayers = grouped.get(groupId) ?? [];
      this.activeGroupId = groupId;
      this.prayersSubject.next(prayers);
      return prayers;
    } catch (error) {
      console.error('[PrayerGroup] loadGroupPrayers failed:', error);
      if (!cached) {
        this.prayersSubject.next([]);
      }
      return this.prayersSubject.value;
    } finally {
      this.loadingPrayersSubject.next(false);
    }
  }

  private setupResumeListeners(): void {
    this.resumeListenerSubscriptions.push(
      fromEvent(window, 'focus').subscribe(() => {
        if (shouldSchedulePrayerResumeRefresh()) {
          this.scheduleResumeRefresh();
        }
      }),
      fromEvent(document, 'visibilitychange').subscribe(() => {
        if (shouldSchedulePrayerResumeRefresh()) {
          this.scheduleResumeRefresh();
        }
      })
    );
  }

  private scheduleResumeRefresh(): void {
    this.resumeRefreshTimeoutId = scheduleDebouncedResumeRefresh(
      this.resumeRefreshTimeoutId,
      PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS,
      () => {
        this.resumeRefreshTimeoutId = null;
        void this.hydrateGroupPrayers({ force: false });
      }
    );
  }

  private publishFocusedGroupFromCache(): void {
    if (!this.activeGroupId) {
      return;
    }
    const cached = this.getCachedGroupPrayers(this.activeGroupId);
    if (cached) {
      this.prayersSubject.next(cached);
    }
  }

  private async writeFetchedGroupPrayers(
    groupIds: string[]
  ): Promise<Map<string, PrayerRequest[]>> {
    const grouped = await this.fetchGroupPrayersByGroupIds(groupIds);
    for (const groupId of groupIds) {
      const prayers = grouped.get(groupId) ?? [];
      this.setCachedGroupPrayers(groupId, prayers);
      if (this.activeGroupId === groupId) {
        this.prayersSubject.next(prayers);
      }
    }
    return grouped;
  }

  private async fetchGroupPrayersByGroupIds(
    groupIds: string[]
  ): Promise<Map<string, PrayerRequest[]>> {
    const { data, error } = await this.supabase.client
      .from('group_prayers')
      .select(GROUP_PRAYERS_SELECT)
      .in('group_id', groupIds)
      .order('date_requested', { ascending: false });
    if (error) throw error;

    const grouped = new Map<string, PrayerRequest[]>();
    for (const id of groupIds) {
      grouped.set(id, []);
    }
    for (const row of (data ?? []) as GroupPrayerRow[]) {
      const prayers = grouped.get(row.group_id);
      if (!prayers) continue;
      prayers.push(this.rowToPrayer(row));
    }
    return grouped;
  }

  private getCachedGroupPrayers(groupId: string): PrayerRequest[] | null {
    return this.cache.get<PrayerRequest[]>(groupPrayersCacheKey(groupId));
  }

  private getStaleGroupPrayers(groupId: string): PrayerRequest[] | null {
    return this.cache.getStale<PrayerRequest[]>(groupPrayersCacheKey(groupId));
  }

  private setCachedGroupPrayers(
    groupId: string,
    prayers: PrayerRequest[]
  ): void {
    this.cache.set(
      groupPrayersCacheKey(groupId),
      prayers,
      PrayerGroupService.GROUP_PRAYERS_CACHE_TTL_MS
    );
    this.publishGroupPrayerCount(groupId, prayers.length);
  }

  private invalidateGroupPrayersCache(groupId: string): void {
    this.cache.invalidate(groupPrayersCacheKey(groupId));
    this.publishGroupPrayerCount(groupId, null);
  }

  private syncGroupPrayerCountFromCache(groupId: string): void {
    const cached =
      this.getCachedGroupPrayers(groupId) ?? this.getStaleGroupPrayers(groupId);
    if (cached) {
      this.publishGroupPrayerCount(groupId, cached.length);
    }
  }

  private publishGroupPrayerCount(
    groupId: string,
    count: number | null
  ): void {
    const next = new Map(this.prayerCountsSubject.value);
    if (count === null) {
      next.delete(groupId);
    } else {
      next.set(groupId, count);
    }
    this.prayerCountsSubject.next(next);
  }

  async addGroupPrayer(
    groupId: string,
    payload: PrayerFormSubmitPayload
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('add a group prayer')) {
      return false;
    }
    try {
      const { data: inserted, error } = await this.supabase.client
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
      if (error) throw error;
      await this.loadGroupPrayers(groupId);
      this.toast.success('Group prayer added');
      void this.notifyGroupPrayerAdded(groupId, payload, inserted.id);
      return true;
    } catch (error) {
      console.error('[PrayerGroup] addGroupPrayer failed:', error);
      this.toast.error(this.errorMessage(error, 'Failed to add group prayer'));
      return false;
    }
  }

  async addGroupPrayerUpdate(
    prayerId: string,
    content: string,
    author: string,
    authorEmail: string,
    markAsAnswered = false
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline('add a group prayer update')) {
      return false;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      this.toast.error('Update content is required');
      return false;
    }
    try {
      const { error } = await this.supabase.client.from('group_prayer_updates').insert({
        group_prayer_id: prayerId,
        content: trimmed,
        author,
        author_email: authorEmail,
        mark_as_answered: markAsAnswered,
      });
      if (error) throw error;
      if (markAsAnswered) {
        await this.supabase.client
          .from('group_prayers')
          .update({
            status: 'answered',
            date_answered: new Date().toISOString(),
          })
          .eq('id', prayerId);
      }
      const groupId = this.prayersSubject.value.find((prayer) => prayer.id === prayerId)
        ?.group_id;
      if (groupId) {
        await this.loadGroupPrayers(groupId);
      }
      const prayer = this.prayersSubject.value.find((row) => row.id === prayerId);
      if (prayer?.group_id) {
        void this.notifyGroupPrayerUpdate(prayer, trimmed, author, authorEmail, markAsAnswered);
      }
      this.toast.success('Update added');
      return true;
    } catch (error) {
      console.error('[PrayerGroup] addGroupPrayerUpdate failed:', error);
      this.toast.error('Failed to add update');
      return false;
    }
  }

  async deleteGroupPrayer(prayerId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete a group prayer')) {
      return false;
    }
    const groupId = this.prayersSubject.value.find((prayer) => prayer.id === prayerId)
      ?.group_id;
    try {
      const { error } = await this.supabase.client
        .from('group_prayers')
        .delete()
        .eq('id', prayerId);
      if (error) throw error;
      if (groupId) {
        await this.loadGroupPrayers(groupId);
      }
      this.toast.success('Prayer deleted');
      return true;
    } catch (error) {
      this.toast.error('Failed to delete prayer');
      return false;
    }
  }

  async deleteGroupPrayerUpdate(updateId: string, prayerId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete a group prayer update')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client
        .from('group_prayer_updates')
        .delete()
        .eq('id', updateId);
      if (error) throw error;
      const groupId = this.prayersSubject.value.find((prayer) => prayer.id === prayerId)
        ?.group_id;
      if (groupId) {
        await this.loadGroupPrayers(groupId);
      }
      return true;
    } catch (error) {
      this.toast.error('Failed to delete update');
      return false;
    }
  }

  private async notifyGroupPrayerAdded(
    groupId: string,
    payload: PrayerFormSubmitPayload,
    prayerId: string
  ): Promise<void> {
    const context = await this.notificationContext(groupId);
    if (!context) return;

    await this.emailNotification.notifyGroupPrayerAdded({
      groupId,
      prayerId,
      title: payload.title,
      description: payload.description,
      requester: payload.is_anonymous ? 'Anonymous' : payload.requester,
      prayerFor: payload.prayer_for,
      status: 'current',
      authorEmail: payload.email,
      memberEmails: context.memberEmails,
      tenantId: context.tenantId,
    });
  }

  private async notifyGroupPrayerUpdate(
    prayer: PrayerRequest,
    content: string,
    author: string,
    authorEmail: string,
    markedAsAnswered: boolean
  ): Promise<void> {
    const groupId = prayer.group_id;
    if (!groupId) return;

    const context = await this.notificationContext(groupId);
    if (!context) return;

    await this.emailNotification.notifyGroupPrayerUpdate({
      groupId,
      prayerId: prayer.id,
      prayerTitle: prayer.title,
      prayerDescription: prayer.description,
      content,
      author,
      authorEmail,
      markedAsAnswered,
      memberEmails: context.memberEmails,
      tenantId: context.tenantId,
    });
  }

  private async notificationContext(
    groupId: string
  ): Promise<{ group: PrayerGroup; memberEmails: string[]; tenantId: string | null } | null> {
    const group = this.groupsSubject.value.find((row) => row.id === groupId);
    if (!group) {
      return null;
    }

    let tenantId = group.created_from_tenant_id ?? null;
    if (!tenantId) {
      const { data } = await this.supabase.client
        .from('tenants')
        .select('id')
        .eq('slug', 'default-tenant')
        .maybeSingle();
      tenantId = data?.id ?? null;
    }

    const members = await this.loadGroupMembers(groupId);
    return {
      group,
      memberEmails: members.map((member) => member.user_email),
      tenantId,
    };
  }

  private rowToPrayer(row: GroupPrayerRow): PrayerRequest {
    const updates: PrayerUpdate[] = (row.group_prayer_updates ?? []).map((update) => ({
      id: update.id,
      prayer_id: row.id,
      content: update.content,
      author: update.author,
      author_email: update.author_email,
      created_at: update.created_at,
      mark_as_answered: update.mark_as_answered,
    }));
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      status: row.status,
      prayer_for: row.prayer_for,
      requester: row.requester,
      email: row.email,
      is_anonymous: row.is_anonymous,
      date_requested: row.date_requested,
      date_answered: row.date_answered,
      created_at: row.created_at,
      updated_at: row.updated_at,
      approval_status: 'approved',
      type: 'prayer',
      updates,
      prayed_for_count: row.prayed_for_count,
      group_id: row.group_id,
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: string }).message;
      if (message) return message;
    }
    return fallback;
  }
}
