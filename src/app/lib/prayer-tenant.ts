export function maybeEq<T>(query: T, column: string, value: unknown): T {
  const withEq = query as unknown as { eq?: (c: string, v: unknown) => T };
  if (query && typeof withEq.eq === 'function') {
    return withEq.eq(column, value);
  }
  return query;
}

export function maybeEqTenantId<T>(
  query: T,
  tenantId: string | null | undefined
): T {
  if (!tenantId) {
    return query;
  }
  return maybeEq(query, 'tenant_id', tenantId);
}

/** Filter to a tenant row, or to unaffiliated (`tenant_id IS NULL`) rows. */
export function eqTenantIdOrUnaffiliated<T>(
  query: T,
  tenantId: string | null | undefined
): T {
  if (tenantId) {
    return maybeEq(query, 'tenant_id', tenantId);
  }
  const withIs = query as unknown as { is?: (column: string, value: null) => T };
  if (query && typeof withIs.is === 'function') {
    return withIs.is('tenant_id', null);
  }
  return query;
}

export function withTenantId<T extends Record<string, unknown>>(
  row: T,
  tenantId: string | null | undefined
): T {
  if (!tenantId) {
    return row;
  }
  return { ...row, tenant_id: tenantId };
}

export function sharedPrayersCacheKey(tenantId: string): string {
  return `tenant_${tenantId}_prayers`;
}

export function personalPrayersTenantCacheKey(tenantId: string): string {
  return `personalTenant_${tenantId}`;
}

export function sharedPrayersCacheKeyForTenant(
  tenantId: string | null | undefined
): string | null {
  if (!tenantId) {
    return null;
  }
  return sharedPrayersCacheKey(tenantId);
}

export const PERSONAL_PRAYERS_UNAFFILIATED_CACHE_KEY = 'personalTenant_unaffiliated';

export function personalPrayersCacheKeyForTenant(
  tenantId: string | null | undefined
): string {
  if (!tenantId) {
    return PERSONAL_PRAYERS_UNAFFILIATED_CACHE_KEY;
  }
  return personalPrayersTenantCacheKey(tenantId);
}

export function groupPrayersCacheKey(groupId: string): string {
  return `groupPrayers:${groupId}`;
}

export function shouldUseSuperAdminTenantPrayerRpc(opts: {
  getIsSuperAdmin?: () => boolean;
  getIsImpersonatingTenant?: () => boolean;
}): boolean {
  return (
    (opts.getIsSuperAdmin?.() ?? false) &&
    (opts.getIsImpersonatingTenant?.() ?? false)
  );
}
