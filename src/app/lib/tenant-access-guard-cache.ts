/** Short-lived SWR cache for tenant slug access checks (session only). */

const STORAGE_PREFIX = 'tenant_access_member:';
const TTL_MS = 5 * 60 * 1000;

export interface TenantAccessMemberCacheEntry {
  state: 'member';
  savedAt: number;
}

export function tenantAccessMemberCacheKey(
  tenantId: string,
  userKey: string
): string {
  return `${STORAGE_PREFIX}${tenantId}:${userKey}`;
}

export function readTenantAccessMemberCache(
  tenantId: string,
  userKey: string,
  storage?: Pick<Storage, 'getItem'>
): boolean {
  const store =
    storage ??
    (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) {
    return false;
  }
  try {
    const raw = store.getItem(tenantAccessMemberCacheKey(tenantId, userKey));
    if (!raw) {
      return false;
    }
    const entry = JSON.parse(raw) as TenantAccessMemberCacheEntry;
    if (entry?.state !== 'member' || typeof entry.savedAt !== 'number') {
      return false;
    }
    return Date.now() - entry.savedAt <= TTL_MS;
  } catch {
    return false;
  }
}

export function writeTenantAccessMemberCache(
  tenantId: string,
  userKey: string,
  storage?: Pick<Storage, 'setItem'>
): void {
  const store =
    storage ??
    (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) {
    return;
  }
  try {
    const entry: TenantAccessMemberCacheEntry = {
      state: 'member',
      savedAt: Date.now(),
    };
    store.setItem(
      tenantAccessMemberCacheKey(tenantId, userKey),
      JSON.stringify(entry)
    );
  } catch {
    // Ignore quota errors.
  }
}

export function clearTenantAccessMemberCache(
  tenantId: string,
  userKey: string,
  storage?: Pick<Storage, 'removeItem'>
): void {
  const store =
    storage ??
    (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) {
    return;
  }
  try {
    store.removeItem(tenantAccessMemberCacheKey(tenantId, userKey));
  } catch {
    // Ignore.
  }
}
