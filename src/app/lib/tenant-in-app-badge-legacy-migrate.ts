import type { InAppBadgeReadState, InAppBadgeReceiptRow } from './in-app-prayer-badge-count';
import { tenantBadgeOrphanNoneReadKey } from './tenant-in-app-badge-read-cache';

const LEGACY_READ_PRAYERS_DATA_KEY = 'read_prayers_data';
const LEGACY_READ_PROMPTS_DATA_KEY = 'read_prompts_data';

export interface TenantBadgeLegacyMigrateInput {
  email: string;
  tenantId: string;
  scopedKey: string;
  readState: InAppBadgeReadState;
  storage: Pick<Storage, 'getItem' | 'removeItem'>;
}

export interface TenantBadgeLegacyMigrateResult {
  mergedReadState: InAppBadgeReadState;
  receiptsToUpsert: InAppBadgeReceiptRow[];
  shouldSkip: boolean;
}

function mergeLegacyPrayersInto(
  merged: InAppBadgeReadState,
  raw: string | null
): void {
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const prayers = Array.isArray(parsed?.prayers)
      ? parsed.prayers
      : Array.isArray(parsed)
        ? parsed
        : [];
    const updates = Array.isArray(parsed?.updates)
      ? parsed.updates
      : Array.isArray(parsed?.prayerUpdates)
        ? parsed.prayerUpdates
        : [];
    merged.prayers = Array.from(new Set([...merged.prayers, ...prayers]));
    merged.prayerUpdates = Array.from(
      new Set([...merged.prayerUpdates, ...updates])
    );
  } catch {
    // ignore
  }
}

function mergeLegacyPromptsInto(
  merged: InAppBadgeReadState,
  raw: string | null
): void {
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const prompts = Array.isArray(parsed?.prompts)
      ? parsed.prompts
      : Array.isArray(parsed)
        ? parsed
        : [];
    const updates = Array.isArray(parsed?.updates)
      ? parsed.updates
      : Array.isArray(parsed?.promptUpdates)
        ? parsed.promptUpdates
        : [];
    merged.prompts = Array.from(new Set([...merged.prompts, ...prompts]));
    merged.promptUpdates = Array.from(
      new Set([...merged.promptUpdates, ...updates])
    );
  } catch {
    // ignore
  }
}

export function planTenantBadgeLegacyMigration(
  input: TenantBadgeLegacyMigrateInput
): TenantBadgeLegacyMigrateResult {
  const { email, scopedKey, readState, storage } = input;
  const orphanNoneKey = tenantBadgeOrphanNoneReadKey(email);
  const orphanNoneRaw = storage.getItem(orphanNoneKey);
  const hasScoped = !!storage.getItem(scopedKey);
  const legacyPrayers = storage.getItem(LEGACY_READ_PRAYERS_DATA_KEY);
  const legacyPrompts = storage.getItem(LEGACY_READ_PROMPTS_DATA_KEY);
  const veryOldPrayers = storage.getItem('read_prayers');
  const veryOldUpdates = storage.getItem('read_prayer_updates');
  const veryOldPrompts = storage.getItem('read_prompts');
  const veryOldPromptUpdates = storage.getItem('read_prompt_updates');

  if (
    hasScoped &&
    !orphanNoneRaw &&
    !legacyPrayers &&
    !legacyPrompts &&
    !veryOldPrayers &&
    !veryOldUpdates &&
    !veryOldPrompts &&
    !veryOldPromptUpdates
  ) {
    return { mergedReadState: readState, receiptsToUpsert: [], shouldSkip: true };
  }

  const merged: InAppBadgeReadState = {
    prayers: [...readState.prayers],
    prayerUpdates: [...readState.prayerUpdates],
    prompts: [...readState.prompts],
    promptUpdates: [...readState.promptUpdates],
  };

  if (orphanNoneRaw) {
    try {
      const parsed = JSON.parse(orphanNoneRaw);
      mergeLegacyPrayersInto(
        merged,
        JSON.stringify({
          prayers: parsed?.prayers,
          updates: parsed?.prayerUpdates ?? parsed?.updates,
        })
      );
      mergeLegacyPromptsInto(
        merged,
        JSON.stringify({
          prompts: parsed?.prompts,
          updates: parsed?.promptUpdates ?? parsed?.updates,
        })
      );
    } catch {
      // ignore
    }
  }

  mergeLegacyPrayersInto(merged, legacyPrayers);
  mergeLegacyPromptsInto(merged, legacyPrompts);

  if (veryOldPrayers) {
    try {
      const prayers = JSON.parse(veryOldPrayers);
      if (Array.isArray(prayers)) {
        merged.prayers = Array.from(new Set([...merged.prayers, ...prayers]));
      }
    } catch {
      // ignore
    }
  }
  if (veryOldUpdates) {
    try {
      const updates = JSON.parse(veryOldUpdates);
      if (Array.isArray(updates)) {
        merged.prayerUpdates = Array.from(
          new Set([...merged.prayerUpdates, ...updates])
        );
      }
    } catch {
      // ignore
    }
  }
  if (veryOldPrompts) {
    try {
      const prompts = JSON.parse(veryOldPrompts);
      if (Array.isArray(prompts)) {
        merged.prompts = Array.from(new Set([...merged.prompts, ...prompts]));
      }
    } catch {
      // ignore
    }
  }
  if (veryOldPromptUpdates) {
    try {
      const updates = JSON.parse(veryOldPromptUpdates);
      if (Array.isArray(updates)) {
        merged.promptUpdates = Array.from(
          new Set([...merged.promptUpdates, ...updates])
        );
      }
    } catch {
      // ignore
    }
  }

  const receiptsToUpsert: InAppBadgeReceiptRow[] = [
    ...merged.prayers.map((id) => ({
      item_kind: 'prayer' as const,
      item_id: id,
    })),
    ...merged.prayerUpdates.map((id) => ({
      item_kind: 'prayer_update' as const,
      item_id: id,
    })),
    ...merged.prompts.map((id) => ({
      item_kind: 'prompt' as const,
      item_id: id,
    })),
    ...merged.promptUpdates.map((id) => ({
      item_kind: 'prompt_update' as const,
      item_id: id,
    })),
  ];

  return { mergedReadState: merged, receiptsToUpsert, shouldSkip: false };
}

export function removeTenantBadgeLegacyStorageKeys(
  email: string,
  storage: Pick<Storage, 'removeItem'>
): void {
  storage.removeItem(tenantBadgeOrphanNoneReadKey(email));
  storage.removeItem(LEGACY_READ_PRAYERS_DATA_KEY);
  storage.removeItem(LEGACY_READ_PROMPTS_DATA_KEY);
  storage.removeItem('read_prayers');
  storage.removeItem('read_prayer_updates');
  storage.removeItem('read_prompts');
  storage.removeItem('read_prompt_updates');
}
