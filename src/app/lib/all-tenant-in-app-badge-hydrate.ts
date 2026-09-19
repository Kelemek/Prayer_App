import {
  emptyInAppBadgeReadState,
  type InAppBadgeCachedItem,
  type InAppBadgeReadState,
} from './in-app-prayer-badge-count';

export type InAppBadgeReceiptKind =
  | 'prayer'
  | 'prayer_update'
  | 'prompt'
  | 'prompt_update';

export interface InAppBadgeReceiptRow {
  item_kind: InAppBadgeReceiptKind;
  item_id: string;
}

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

export function receiptsToReadState(
  rows: InAppBadgeReceiptRow[]
): InAppBadgeReadState {
  const next = emptyInAppBadgeReadState();
  for (const row of rows) {
    const id = String(row.item_id);
    switch (row.item_kind) {
      case 'prayer':
        next.prayers.push(id);
        break;
      case 'prayer_update':
        next.prayerUpdates.push(id);
        break;
      case 'prompt':
        next.prompts.push(id);
        break;
      case 'prompt_update':
        next.promptUpdates.push(id);
        break;
      default: {
        const _exhaustive: never = row.item_kind;
        void _exhaustive;
        break;
      }
    }
  }
  return next;
}

export function mergeReceiptsIntoReadState(
  stored: InAppBadgeReadState,
  rows: InAppBadgeReceiptRow[]
): InAppBadgeReadState {
  const fromRows = receiptsToReadState(rows);
  return {
    prayers: Array.from(new Set([...stored.prayers, ...fromRows.prayers])),
    prayerUpdates: Array.from(
      new Set([...stored.prayerUpdates, ...fromRows.prayerUpdates])
    ),
    prompts: Array.from(new Set([...stored.prompts, ...fromRows.prompts])),
    promptUpdates: Array.from(
      new Set([...stored.promptUpdates, ...fromRows.promptUpdates])
    ),
  };
}

/**
 * Fill local caches for other member tenants so the icon badge can sum
 * the same in-app counts the user would see after switching churches.
 */
export async function hydrateMissingTenantInAppBadgeCaches(
  deps: AllTenantInAppBadgeHydrateDeps
): Promise<string[]> {
  const hydrated: string[] = [];
  const email = deps.email.trim().toLowerCase();
  if (!email) {
    return hydrated;
  }

  for (const tenantId of deps.tenantIds) {
    if (!tenantId || tenantId === deps.skipTenantId) {
      continue;
    }
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
      hydrated.push(tenantId);
    } catch {
      // Best-effort: keep whatever local caches already exist.
    }
  }
  return hydrated;
}
