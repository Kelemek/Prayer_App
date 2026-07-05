export type PlanTier = 'free' | 'groups' | 'churches';
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
export type TenantMembershipRole = 'member' | 'leader' | 'tenant_admin';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  plan_status: PlanStatus;
}

export interface TenantMembership {
  id?: string;
  tenant_id: string;
  user_email: string;
  role: TenantMembershipRole;
  tenants?: Tenant | Tenant[] | null;
  name?: string;
  is_active?: boolean;
  is_blocked?: boolean;
  receive_admin_emails?: boolean;
  receive_push?: boolean;
  receive_admin_push?: boolean;
  badge_functionality_enabled?: boolean;
  default_prayer_view?: string;
  last_activity_date?: string | null;
  unsubscribe_token?: string;
  updated_at?: string;
  auth_user_id?: string | null;
  created_at?: string;
}
