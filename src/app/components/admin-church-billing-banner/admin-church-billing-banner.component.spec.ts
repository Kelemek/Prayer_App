import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminChurchBillingBannerComponent } from './admin-church-billing-banner.component';
import { ChangeDetectorRef } from '@angular/core';

describe('AdminChurchBillingBannerComponent', () => {
  const churchCheckout = {
    isNativeStripeCheckoutUi: vi.fn(() => false),
    startBillingPortal: vi.fn().mockResolvedValue('https://billing.example/portal'),
    startChurchCheckout: vi.fn().mockResolvedValue('https://billing.example/checkout'),
    openBillingUrl: vi.fn().mockResolvedValue(undefined),
  };

  const toast = {
    error: vi.fn(),
    success: vi.fn(),
  };

  const churchTenant = {
    id: 't1',
    slug: 'my-church',
    name: 'Church',
    plan_tier: 'churches' as const,
    plan_status: 'incomplete' as const,
    stripe_customer_id: 'cus_1',
  };

  let component: AdminChurchBillingBannerComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    component = new AdminChurchBillingBannerComponent(
      churchCheckout as never,
      toast as never,
      { markForCheck: vi.fn() } as ChangeDetectorRef
    );
  });

  it('clears banner when user cannot manage billing', () => {
    component.tenant = churchTenant;
    component.canManage = false;
    component.ngOnChanges({
      tenant: { currentValue: churchTenant, previousValue: null, firstChange: true, isFirstChange: () => true },
      canManage: { currentValue: false, previousValue: null, firstChange: true, isFirstChange: () => true },
    });
    expect(component.bannerMessage).toBeNull();
    expect(component.showCheckout).toBe(false);
  });

  it('shows checkout for free church tier and opens billing url', async () => {
    component.tenant = churchTenant;
    component.canManage = true;
    component.ngOnChanges({
      tenant: { currentValue: churchTenant, previousValue: null, firstChange: true, isFirstChange: () => true },
      canManage: { currentValue: true, previousValue: null, firstChange: true, isFirstChange: () => true },
    });
    expect(component.showCheckout).toBe(true);
    await component.onCheckout();
    expect(churchCheckout.startChurchCheckout).toHaveBeenCalledWith('t1', 'my-church');
    expect(churchCheckout.openBillingUrl).toHaveBeenCalledWith('https://billing.example/checkout');
  });

  it('uses amber styling when billing is past due', () => {
    component.tenant = {
      ...churchTenant,
      plan_tier: 'churches',
      plan_status: 'past_due',
      grace_until: new Date(Date.now() + 86400000).toISOString(),
    };
    expect(component.bannerClass).toContain('amber');
  });

  it('opens billing portal from manage billing', async () => {
    component.tenant = {
      ...churchTenant,
      plan_tier: 'churches',
      plan_status: 'active',
      stripe_customer_id: 'cus_1',
    };
    component.canManage = true;
    component.ngOnChanges({
      tenant: { currentValue: component.tenant, previousValue: null, firstChange: true, isFirstChange: () => true },
      canManage: { currentValue: true, previousValue: null, firstChange: true, isFirstChange: () => true },
    });
    await component.onManageBilling();
    expect(churchCheckout.startBillingPortal).toHaveBeenCalled();
  });
});
