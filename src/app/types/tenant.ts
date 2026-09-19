export type PlanTier = 'free' | 'groups' | 'churches';
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
export type TenantMembershipRole = 'member' | 'leader' | 'tenant_admin';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  plan_status: PlanStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_cancel_at_period_end?: boolean;
  stripe_current_period_end?: string | null;
  past_due_since?: string | null;
  grace_until?: string | null;
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
  in_planning_center?: boolean | null;
  planning_center_checked_at?: string | null;
  planning_center_list_id?: string | null;
}

export interface TenantIntegrations {
  tenant_id: string;
  pco_enabled: boolean;
  pco_configured_at?: string | null;
  pco_app_id_last4?: string | null;
}

export interface TenantUserDirectoryTenant {
  id: string;
  name: string;
}

export interface TenantUserDirectoryGroup {
  id: string;
  name: string;
}

export interface TenantUserDirectoryRow {
  email: string;
  name: string;
  tenants: TenantUserDirectoryTenant[];
  groups: TenantUserDirectoryGroup[];
}
