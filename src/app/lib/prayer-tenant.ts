export function maybeEq<T>(query: T, column: string, value: unknown): T {
  if (query && typeof (query as { eq?: (c: string, v: unknown) => T }).eq === 'function') {
    return (query as { eq: (c: string, v: unknown) => T }).eq(column, value);
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

export function personalPrayersCacheKeyForTenant(
  tenantId: string | null | undefined
): string | null {
  if (!tenantId) {
    return null;
  }
  return personalPrayersTenantCacheKey(tenantId);
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
