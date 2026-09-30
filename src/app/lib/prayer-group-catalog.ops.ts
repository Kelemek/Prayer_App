import { writeMemberPrayerGroupIdsToStorage } from './group-in-app-badge-count';
import { PrayerGroupInternalState } from './prayer-group-internal.state';
import {
  prayerGroupErrorMessage,
  type PrayerGroupOpsDeps,
} from './prayer-group-ops-deps';
import type {
  PrayerGroup,
  PrayerGroupMember,
  PrayerGroupMembershipProfile,
} from '../types/prayer-group';

export class PrayerGroupCatalogOps {
  constructor(
    private readonly state: PrayerGroupInternalState,
    private readonly deps: PrayerGroupOpsDeps
  ) {}

  getGroups(): PrayerGroup[] {
    return this.state.groupsSubject.value;
  }

  canCreatePrayerGroups(): boolean {
    return this.state.canCreate;
  }

  canAccessGroupsTab(): boolean {
    return this.state.canCreate || this.state.groupsSubject.value.length > 0;
  }

  async refreshCapabilities(): Promise<void> {
    const email = await this.deps.authIdentity.getEmail();
    if (!email) {
      this.state.canCreate = false;
      return;
    }
    const { data, error } = await this.deps.supabase.client.rpc(
      'can_create_prayer_groups',
      { email_to_check: email }
    );
    if (error) {
      console.error('[PrayerGroup] can_create_prayer_groups failed:', error);
      this.state.canCreate = false;
      return;
    }
    this.state.canCreate = data === true;
  }

  async loadMyGroups(): Promise<PrayerGroup[]> {
    this.state.loadingGroupsSubject.next(true);
    try {
      await this.refreshCapabilities();
      const email = await this.deps.authIdentity.getEmail();
      if (!email) {
        this.state.groupsSubject.next([]);
        return [];
      }

      const { data: memberships, error: memberError } = await this.deps.supabase.client
        .from('prayer_group_members')
        .select('group_id, role, is_active, display_order')
        .eq('user_email', email.toLowerCase())
        .eq('is_active', true);
      if (memberError) {
        throw memberError;
      }

      const rows = (memberships ?? []) as {
        group_id: string;
        role: 'owner' | 'member';
        display_order: number;
      }[];
      if (rows.length === 0) {
        this.state.groupsSubject.next([]);
        this.persistMemberGroupIdsForBadges(email, []);
        return [];
      }

      const ids = rows.map((row) => row.group_id);
      const { data: groups, error: groupsError } = await this.deps.supabase.client
        .from('prayer_groups')
        .select('id, name, created_by_email, created_from_tenant_id, created_at, updated_at')
        .in('id', ids);
      if (groupsError) {
        throw groupsError;
      }

      const roleById = new Map(rows.map((row) => [row.group_id, row.role]));
      const orderById = new Map(rows.map((row) => [row.group_id, row.display_order]));
      const groupById = new Map(
        ((groups ?? []) as PrayerGroup[]).map((group) => [group.id, group])
      );
      const mapped: PrayerGroup[] = [];
      for (const row of rows) {
        const group = groupById.get(row.group_id);
        if (!group) {
          continue;
        }
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
      this.state.groupsSubject.next(mapped);
      this.persistMemberGroupIdsForBadges(
        email,
        mapped.map((group) => group.id)
      );
      return mapped;
    } catch (error) {
      console.error('[PrayerGroup] loadMyGroups failed:', error);
      this.state.groupsSubject.next([]);
      return [];
    } finally {
      this.state.loadingGroupsSubject.next(false);
    }
  }

  async createGroup(name: string): Promise<PrayerGroup | null> {
    if (!this.deps.connectivity.requireOnline('create a group')) {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      this.deps.toast.error('Enter a group name');
      return null;
    }
    try {
      const { data, error } = await this.deps.supabase.client.rpc('create_prayer_group', {
        p_name: trimmed,
      });
      if (error) {
        throw error;
      }
      const groups = await this.loadMyGroups();
      const created = groups.find((group) => group.id === data) ?? null;
      this.deps.toast.success('Group created');
      return created;
    } catch (error) {
      console.error('[PrayerGroup] createGroup failed:', error);
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to create group'));
      return null;
    }
  }

  async inviteMembers(groupId: string, emails: string[]): Promise<number> {
    if (!this.deps.connectivity.requireOnline('invite group members')) {
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
      this.deps.toast.error('Enter at least one valid email address');
      return 0;
    }

    const group = this.state.groupsSubject.value.find((item) => item.id === groupId);
    const inviterName =
      this.deps.userSession.getCurrentSession()?.fullName?.trim() ||
      (await this.deps.authIdentity.getEmail()) ||
      'A group member';
    let invited = 0;
    for (const email of unique) {
      try {
        const { error } = await this.deps.supabase.client.rpc('invite_prayer_group_member', {
          p_group_id: groupId,
          p_email: email,
        });
        if (error) {
          throw error;
        }
        invited += 1;
        void this.deps.emailNotification.sendGroupInvitation({
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
      this.deps.toast.success(
        invited === 1 ? 'Invitation sent' : `${invited} invitations sent`
      );
    } else {
      this.deps.toast.error('Could not send invitations');
    }
    return invited;
  }

  async reorderGroups(orderedGroupIds: string[]): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('reorder groups')) {
      return false;
    }
    if (orderedGroupIds.length === 0) {
      return true;
    }

    const current = this.state.groupsSubject.value;
    const byId = new Map(current.map((group) => [group.id, group]));
    const reordered = orderedGroupIds
      .map((id) => byId.get(id))
      .filter((group): group is PrayerGroup => group != null);
    if (reordered.length !== orderedGroupIds.length) {
      return false;
    }

    this.state.groupsSubject.next(reordered);

    try {
      const { error } = await this.deps.supabase.client.rpc('reorder_prayer_groups', {
        p_ordered_group_ids: orderedGroupIds,
      });
      if (error) {
        throw error;
      }
      return true;
    } catch (error) {
      console.error('[PrayerGroup] reorderGroups failed:', error);
      await this.loadMyGroups();
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to reorder groups'));
      return false;
    }
  }

  async renameGroup(groupId: string, name: string): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('rename a group')) {
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client.rpc('rename_prayer_group', {
        p_group_id: groupId,
        p_name: name.trim(),
      });
      if (error) {
        throw error;
      }
      await this.loadMyGroups();
      this.deps.toast.success('Group renamed');
      return true;
    } catch (error) {
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to rename group'));
      return false;
    }
  }

  async deleteGroup(
    groupId: string,
    onDeleted?: (deletedGroupId: string) => void
  ): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('delete a group')) {
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client.rpc('delete_prayer_group', {
        p_group_id: groupId,
      });
      if (error) {
        throw error;
      }
      await this.loadMyGroups();
      onDeleted?.(groupId);
      this.deps.toast.success('Group deleted');
      return true;
    } catch (error) {
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to delete group'));
      return false;
    }
  }

  async leaveGroup(groupId: string): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('leave a group')) {
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client.rpc('leave_prayer_group', {
        p_group_id: groupId,
      });
      if (error) {
        throw error;
      }
      await this.loadMyGroups();
      this.deps.toast.success('You left the group');
      return true;
    } catch (error) {
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to leave group'));
      return false;
    }
  }

  async loadGroupMembers(groupId: string): Promise<PrayerGroupMember[]> {
    try {
      const { data, error } = await this.deps.supabase.client
        .from('prayer_group_members')
        .select(
          'id, group_id, user_email, role, invited_by_email, name, is_active, created_at, updated_at'
        )
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as PrayerGroupMember[];
    } catch (error) {
      console.error('[PrayerGroup] loadGroupMembers failed:', error);
      return [];
    }
  }

  async removeMember(groupId: string, email: string): Promise<boolean> {
    if (!this.deps.connectivity.requireOnline('remove a group member')) {
      return false;
    }
    try {
      const { error } = await this.deps.supabase.client.rpc('remove_prayer_group_member', {
        p_group_id: groupId,
        p_email: email,
      });
      if (error) {
        throw error;
      }
      this.deps.toast.success('Member removed');
      return true;
    } catch (error) {
      this.deps.toast.error(prayerGroupErrorMessage(error, 'Failed to remove member'));
      return false;
    }
  }

  async getMembershipProfile(
    email?: string | null
  ): Promise<PrayerGroupMembershipProfile> {
    const userEmail = (email || (await this.deps.authIdentity.getEmail()) || '')
      .toLowerCase()
      .trim();
    if (!userEmail) {
      return { hasMembership: false, name: null };
    }
    const { data, error } = await this.deps.supabase.client
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
    const email = await this.deps.authIdentity.getEmail();
    if (!email) {
      return false;
    }
    const { error } = await this.deps.supabase.client.rpc('set_prayer_group_member_name', {
      p_email: email,
      p_name: fullName.trim(),
    });
    if (error) {
      console.error('[PrayerGroup] setMemberName failed:', error);
      return false;
    }
    return true;
  }

  private persistMemberGroupIdsForBadges(
    email: string,
    groupIds: string[]
  ): void {
    if (typeof localStorage === 'undefined' || !email.trim()) {
      return;
    }
    writeMemberPrayerGroupIdsToStorage(localStorage, email, groupIds);
    this.deps.refreshGroupBadgeCounts();
  }
}
