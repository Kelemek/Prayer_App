import {
  parseCachedBadgeItems,
  type InAppBadgeCachedItem,
} from './in-app-prayer-badge-count';

/** Prayer or prompt row shape in list-page localStorage caches. */
export interface TenantBadgeCachedItem {
  id: string;
  status?: 'current' | 'answered' | 'archived';
  type?: string;
  updated_at: string;
  email?: string | null;
  user_email?: string | null;
  updates?: Array<{
    id: string;
    created_at: string;
    updated_at?: string;
    author_email?: string | null;
  }>;
}

export function readTenantBadgeCachedItems(
  storage: Pick<Storage, 'getItem'>,
  cacheKey: string,
  options?: { propagateErrors?: boolean }
): TenantBadgeCachedItem[] {
  try {
    const cached = storage.getItem(cacheKey);
    if (!cached) {
      return [];
    }
    const parsedCache = JSON.parse(cached);
    const items = parsedCache?.data || parsedCache || [];
    return Array.isArray(items) ? (items as TenantBadgeCachedItem[]) : [];
  } catch (error) {
    if (options?.propagateErrors) {
      throw error;
    }
    return [];
  }
}

export function tenantBadgeCacheHasItems(
  storage: Pick<Storage, 'getItem'>,
  cacheKey: string
): boolean {
  return readTenantBadgeCachedItems(storage, cacheKey).length > 0;
}

export function collectTenantBadgeUpdateIds(
  items: TenantBadgeCachedItem[]
): string[] {
  const allUpdateIds: string[] = [];
  for (const item of items) {
    if (!item.updates?.length) {
      continue;
    }
    for (const update of item.updates) {
      if (update.id && !allUpdateIds.includes(update.id)) {
        allUpdateIds.push(update.id);
      }
    }
  }
  return allUpdateIds;
}

export function findTenantBadgePrayerItem(
  storage: Pick<Storage, 'getItem'>,
  prayersCacheKey: string,
  prayerId: string
): InAppBadgeCachedItem | null {
  try {
    const cached = storage.getItem(prayersCacheKey);
    if (!cached) {
      return null;
    }
    const items = parseCachedBadgeItems(cached);
    return items.find((item) => item.id === prayerId) ?? null;
  } catch {
    return null;
  }
}

export function findTenantBadgePrayerUpdate(
  storage: Pick<Storage, 'getItem'>,
  prayersCacheKey: string,
  updateId: string
): { update: NonNullable<InAppBadgeCachedItem['updates']>[number] } | null {
  try {
    const cached = storage.getItem(prayersCacheKey);
    if (!cached) {
      return null;
    }
    const items = parseCachedBadgeItems(cached);
    for (const item of items) {
      if (!item.updates?.length) {
        continue;
      }
      const update = item.updates.find((row) => row.id === updateId);
      if (update) {
        return { update };
      }
    }
    return null;
  } catch {
    return null;
  }
}
