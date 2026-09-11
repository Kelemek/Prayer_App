import type { PlanStatus, Tenant } from '../types/tenant';

export interface ChurchBillingTenant extends Tenant {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_cancel_at_period_end?: boolean;
  stripe_current_period_end?: string | null;
  past_due_since?: string | null;
  grace_until?: string | null;
}

export function tenantHasChurchFeatures(
  tenant: ChurchBillingTenant | null | undefined,
  now: Date = new Date()
): boolean {
  if (!tenant || tenant.plan_tier !== 'churches') {
    return false;
  }
  const status = tenant.plan_status;
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  if (status === 'past_due' && tenant.grace_until) {
    return new Date(tenant.grace_until) > now;
  }
  if (status === 'canceled' && tenant.stripe_current_period_end) {
    return new Date(tenant.stripe_current_period_end) > now;
  }
  return false;
}

export function isChurchPlanTier(tenant: Tenant | null | undefined): boolean {
  return tenant?.plan_tier === 'churches';
}

export function canManageChurchBilling(
  tenant: ChurchBillingTenant | null | undefined,
  now: Date = new Date()
): boolean {
  if (!tenant?.stripe_customer_id) {
    return false;
  }
  return tenantHasChurchFeatures(tenant, now) || tenant.plan_status === 'past_due';
}

export function shouldShowChurchCheckout(
  tenant: ChurchBillingTenant | null | undefined,
  now: Date = new Date()
): boolean {
  if (!tenant) return false;
  if (tenant.plan_tier === 'free') return true;
  if (tenant.plan_tier === 'churches' && tenant.plan_status === 'incomplete') {
    return true;
  }
  if (tenant.plan_tier === 'churches' && !tenantHasChurchFeatures(tenant, now)) {
    return tenant.plan_status === 'canceled' || tenant.plan_status === 'incomplete';
  }
  return false;
}

export function churchBillingBannerMessage(
  tenant: ChurchBillingTenant,
  now: Date = new Date()
): string | null {
  if (tenant.plan_status === 'past_due' && tenant.grace_until) {
    const graceEnd = new Date(tenant.grace_until);
    if (graceEnd > now) {
      return `Church billing is past due. Update payment by ${graceEnd.toLocaleDateString()} to keep Church features.`;
    }
    return 'Church billing grace period has ended. Update payment to restore Church features.';
  }
  if (
    tenant.stripe_cancel_at_period_end &&
    tenant.stripe_current_period_end &&
    new Date(tenant.stripe_current_period_end) > now
  ) {
    return `Church subscription ends on ${new Date(tenant.stripe_current_period_end).toLocaleDateString()}.`;
  }
  if (tenant.plan_status === 'incomplete') {
    return 'Complete Church checkout to unlock shared prayer wall and admin features.';
  }
  return null;
}

export function formatPlanStatus(status: PlanStatus): string {
  return status.replace('_', ' ');
}
