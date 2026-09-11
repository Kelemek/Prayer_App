import { describe, it, expect } from 'vitest';
import {
  canManageChurchBilling,
  churchBillingBannerMessage,
  shouldShowChurchCheckout,
  tenantHasChurchFeatures,
} from './church-billing';
import type { ChurchBillingTenant } from './church-billing';

const baseTenant = (overrides: Partial<ChurchBillingTenant>): ChurchBillingTenant => ({
  id: 't1',
  name: 'Test',
  slug: 'test',
  plan_tier: 'churches',
  plan_status: 'active',
  ...overrides,
});

describe('church-billing', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  it('grants features for active church', () => {
    expect(tenantHasChurchFeatures(baseTenant({}), now)).toBe(true);
  });

  it('grants features during past_due grace', () => {
    expect(
      tenantHasChurchFeatures(
        baseTenant({
          plan_status: 'past_due',
          grace_until: '2026-09-15T00:00:00Z',
        }),
        now
      )
    ).toBe(true);
  });

  it('denies features for incomplete church', () => {
    expect(
      tenantHasChurchFeatures(baseTenant({ plan_status: 'incomplete' }), now)
    ).toBe(false);
  });

  it('grants features until period end after cancel', () => {
    expect(
      tenantHasChurchFeatures(
        baseTenant({
          plan_status: 'canceled',
          stripe_current_period_end: '2026-09-20T00:00:00Z',
        }),
        now
      )
    ).toBe(true);
  });

  it('shows checkout for incomplete church', () => {
    expect(shouldShowChurchCheckout(baseTenant({ plan_status: 'incomplete' }), now)).toBe(
      true
    );
  });

  it('allows manage billing when past_due with customer id', () => {
    expect(
      canManageChurchBilling(
        baseTenant({
          plan_status: 'past_due',
          stripe_customer_id: 'cus_123',
          grace_until: '2026-09-15T00:00:00Z',
        }),
        now
      )
    ).toBe(true);
  });

  it('returns past_due banner message', () => {
    const msg = churchBillingBannerMessage(
      baseTenant({
        plan_status: 'past_due',
        grace_until: '2026-09-15T00:00:00Z',
      }),
      now
    );
    expect(msg).toContain('past due');
  });
});
