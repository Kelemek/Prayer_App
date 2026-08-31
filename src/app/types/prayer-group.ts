export type PrayerGroupMemberRole = 'owner' | 'member';

export interface PrayerGroup {
  id: string;
  name: string;
  created_by_email: string;
  created_from_tenant_id?: string | null;
  created_at: string;
  updated_at: string;
  my_role?: PrayerGroupMemberRole;
}

export interface PrayerGroupMember {
  id: string;
  group_id: string;
  user_email: string;
  role: PrayerGroupMemberRole;
  invited_by_email?: string | null;
  name?: string | null;
  is_active?: boolean;
}

export interface PrayerGroupMembershipProfile {
  hasMembership: boolean;
  name: string | null;
}
