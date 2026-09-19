import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inAppBadgeItemSnapshotKey,
  parseInAppBadgeReadState,
  promptsCacheKeyForTenant,
  receiptsToReadState,
  scopedInAppBadgeReadCacheKey,
  storageHasKey,
  unionInAppBadgeReadState,
  type InAppBadgeCachedItem,
  type InAppBadgeReadState,
  type InAppBadgeReceiptRow,
} from './in-app-prayer-badge-count';
import {
  fetchApprovedSharedPrayerUpdates,
  fetchApprovedSharedPrayers,
} from './prayer-community-db';
import {
  formatApprovedCommunityPrayersFromUpdatesMap,
  groupPrayerUpdatesByPrayerId,
} from './prayer-community-load';
import { sharedPrayersCacheKey } from './prayer-tenant';

export type {
  InAppBadgeReceiptKind,
  InAppBadgeReceiptRow,
} from './in-app-prayer-badge-count';

export { receiptsToReadState };

export interface AllTenantInAppBadgeHydrateDeps {
  tenantIds: string[];
  skipTenantId?: string | null;
  email: string;
  hasPrayerCache: (tenantId: string) => boolean;
  hasPromptCache: (tenantId: string) => boolean;
  readStoredReadState: (tenantId: string) => InAppBadgeReadState;
  writeReadState: (tenantId: string, state: InAppBadgeReadState) => void;
  writePrayerCache: (tenantId: string, items: InAppBadgeCachedItem[]) => void;
  writePromptCache: (tenantId: string, items: InAppBadgeCachedItem[]) => void;
  loadReceipts: (tenantId: string) => Promise<InAppBadgeReceiptRow[]>;
  loadPrayers: (tenantId: string) => Promise<InAppBadgeCachedItem[]>;
  loadPrompts: (tenantId: string) => Promise<InAppBadgeCachedItem[]>;
}

export function mergeReceiptsIntoReadState(
  stored: InAppBadgeReadState,
  rows: InAppBadgeReceiptRow[]
): InAppBadgeReadState {
  return unionInAppBadgeReadState(stored, receiptsToReadState(rows));
}

/**
 * Fill badge-owned snapshots for other member tenants so the icon can sum
 * the same in-app counts the user would see after switching churches.
 * Does not write list-page prayer/prompt caches.
 */
export async function hydrateMissingTenantInAppBadgeCaches(
  deps: AllTenantInAppBadgeHydrateDeps
): Promise<string[]> {
  const email = deps.email.trim().toLowerCase();
  if (!email) {
    return [];
  }

  const targets = deps.tenantIds.filter(
    (tenantId) => !!tenantId && tenantId !== deps.skipTenantId
  );
  const results = await Promise.all(
    targets.map(async (tenantId) => {
      try {
        const receipts = await deps.loadReceipts(tenantId);
        const stored = deps.readStoredReadState(tenantId);
        deps.writeReadState(
          tenantId,
          mergeReceiptsIntoReadState(stored, receipts)
        );

        if (!deps.hasPrayerCache(tenantId)) {
          const prayers = await deps.loadPrayers(tenantId);
          deps.writePrayerCache(tenantId, prayers);
        }
        if (!deps.hasPromptCache(tenantId)) {
          const prompts = await deps.loadPrompts(tenantId);
          deps.writePromptCache(tenantId, prompts);
        }
        return tenantId;
      } catch {
        return null;
      }
    })
  );
  return results.filter((tenantId): tenantId is string => tenantId != null);
}

export async function loadInAppBadgeReceipts(
  client: SupabaseClient,
  tenantId: string,
  email: string
): Promise<InAppBadgeReceiptRow[]> {
  const { data, error } = await client.rpc('get_badge_read_receipts', {
    p_tenant_id: tenantId,
    p_user_email: email,
  });
  if (error) {
    throw error;
  }
  return (data || []) as InAppBadgeReceiptRow[];
}

export async function loadInAppBadgePrayerItems(
  client: SupabaseClient,
  tenantId: string
): Promise<InAppBadgeCachedItem[]> {
  const { prayersData, error } = await fetchApprovedSharedPrayers(client, {
    tenantId,
    useSuperAdminRpc: false,
    actorEmail: null,
  });
  if (error) {
    throw error;
  }
  const prayerIds = (prayersData || [])
    .map((p: { id?: string }) => p.id)
    .filter((id: string | undefined): id is string => !!id);
  const { updatesData, error: updatesError } =
    await fetchApprovedSharedPrayerUpdates(client, prayerIds, {
      tenantId,
      useSuperAdminRpc: false,
      actorEmail: null,
    });
  if (updatesError) {
    throw updatesError;
  }
  return formatApprovedCommunityPrayersFromUpdatesMap(
    prayersData || [],
    groupPrayerUpdatesByPrayerId(updatesData)
  );
}

export async function loadInAppBadgePromptItems(
  client: SupabaseClient,
  tenantId: string
): Promise<InAppBadgeCachedItem[]> {
  const typesTable: any = client.from('prayer_types');
  if (typeof typesTable?.select !== 'function') {
    return [];
  }
  const { data: typesData, error: typesError } = await typesTable
    .select('name')
    .eq('is_active', true)
    .eq('tenant_id', tenantId);
  if (typesError) {
    throw typesError;
  }
  const activeTypeNames = new Set(
    (typesData || [])
      .map((row: { name?: string }) => row.name)
      .filter((name: string | undefined): name is string => !!name)
  );

  const promptsTable: any = client.from('prayer_prompts');
  if (typeof promptsTable?.select !== 'function') {
    return [];
  }
  const { data, error } = await promptsTable
    .select('id, type, updated_at')
    .eq('tenant_id', tenantId);
  if (error) {
    throw error;
  }
  const rows = (data || []) as Array<{ id?: string; type?: string }>;
  return rows
    .filter((row) => !!row.id && activeTypeNames.has(row.type ?? ''))
    .map((row) => ({ id: String(row.id) }));
}

export function tenantHasInAppBadgeItemCache(
  storage: Pick<Storage, 'getItem'>,
  tenantId: string,
  kind: 'prayers' | 'prompts'
): boolean {
  const listKey =
    kind === 'prayers'
      ? sharedPrayersCacheKey(tenantId)
      : promptsCacheKeyForTenant(tenantId);
  return (
    storageHasKey(storage, listKey) ||
    storageHasKey(storage, inAppBadgeItemSnapshotKey(tenantId, kind))
  );
}

export function createLocalStorageAllTenantInAppBadgeHydrateDeps(input: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  client: SupabaseClient;
  email: string;
  tenantIds: string[];
  skipTenantId?: string | null;
}): AllTenantInAppBadgeHydrateDeps {
  const email = input.email.trim().toLowerCase();
  return {
    tenantIds: input.tenantIds,
    skipTenantId: input.skipTenantId,
    email,
    hasPrayerCache: (tenantId) =>
      tenantHasInAppBadgeItemCache(input.storage, tenantId, 'prayers'),
    hasPromptCache: (tenantId) =>
      tenantHasInAppBadgeItemCache(input.storage, tenantId, 'prompts'),
    readStoredReadState: (tenantId) =>
      parseInAppBadgeReadState(
        input.storage.getItem(scopedInAppBadgeReadCacheKey(tenantId, email))
      ),
    writeReadState: (tenantId, state) => {
      input.storage.setItem(
        scopedInAppBadgeReadCacheKey(tenantId, email),
        JSON.stringify(state)
      );
    },
    writePrayerCache: (tenantId, items) => {
      input.storage.setItem(
        inAppBadgeItemSnapshotKey(tenantId, 'prayers'),
        JSON.stringify(items)
      );
    },
    writePromptCache: (tenantId, items) => {
      input.storage.setItem(
        inAppBadgeItemSnapshotKey(tenantId, 'prompts'),
        JSON.stringify(items)
      );
    },
    loadReceipts: (tenantId) =>
      loadInAppBadgeReceipts(input.client, tenantId, email),
    loadPrayers: (tenantId) => loadInAppBadgePrayerItems(input.client, tenantId),
    loadPrompts: (tenantId) => loadInAppBadgePromptItems(input.client, tenantId),
  };
}
