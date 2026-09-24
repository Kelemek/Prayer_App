import { describe, expect, it, vi } from 'vitest';
import {
  eqTenantIdOrUnaffiliated,
  groupPrayersCacheKey,
  maybeEq,
  maybeEqTenantId,
  personalPrayersCacheKeyForTenant,
  PERSONAL_PRAYERS_UNAFFILIATED_CACHE_KEY,
  sharedPrayersCacheKeyForTenant,
  shouldUseSuperAdminTenantPrayerRpc,
  withTenantId,
} from './prayer-tenant';

describe('prayer-tenant', () => {
  it('maybeEq calls eq when available', () => {
    const query = {
      eq: (col: string, val: unknown) => ({ col, val }),
    };
    expect(maybeEq(query, 'tenant_id', 't1')).toEqual({
      col: 'tenant_id',
      val: 't1',
    });
    expect(maybeEq(null, 'tenant_id', 't1')).toBeNull();
  });

  it('maybeEqTenantId skips filter without tenant id', () => {
    const query = { eq: vi.fn() };
    expect(maybeEqTenantId(query, null)).toBe(query);
  });

  it('eqTenantIdOrUnaffiliated filters null tenant as IS NULL', () => {
    const query = {
      is: (col: string, val: null) => ({ col, val }),
    };
    expect(eqTenantIdOrUnaffiliated(query, null)).toEqual({
      col: 'tenant_id',
      val: null,
    });
    expect(eqTenantIdOrUnaffiliated({ eq: (c: string, v: string) => v }, 't1')).toBe(
      't1'
    );
  });

  it('withTenantId adds tenant_id when present', () => {
    expect(withTenantId({ title: 'x' }, 't1')).toEqual({
      title: 'x',
      tenant_id: 't1',
    });
    expect(withTenantId({ title: 'x' }, null)).toEqual({ title: 'x' });
  });

  it('builds cache keys for shared and personal prayers', () => {
    expect(sharedPrayersCacheKeyForTenant('t1')).toBe('tenant_t1_prayers');
    expect(sharedPrayersCacheKeyForTenant(null)).toBeNull();
    expect(personalPrayersCacheKeyForTenant('t1')).toBe('personalTenant_t1');
    expect(personalPrayersCacheKeyForTenant(undefined)).toBe(
      PERSONAL_PRAYERS_UNAFFILIATED_CACHE_KEY
    );
    expect(groupPrayersCacheKey('g1')).toBe('groupPrayers:g1');
  });

  it('shouldUseSuperAdminTenantPrayerRpc requires super admin impersonation', () => {
    expect(
      shouldUseSuperAdminTenantPrayerRpc({
        getIsSuperAdmin: () => true,
        getIsImpersonatingTenant: () => true,
      })
    ).toBe(true);
    expect(
      shouldUseSuperAdminTenantPrayerRpc({
        getIsSuperAdmin: () => true,
        getIsImpersonatingTenant: () => false,
      })
    ).toBe(false);
  });
});
