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
}
