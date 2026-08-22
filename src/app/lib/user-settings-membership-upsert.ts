import type { TenantMembershipPreferencesService } from '../services/tenant-membership-preferences.service';

function throwIfUpsertFailed(
  result: { ok: true } | { ok: false; error: unknown }
): void {
  if (result.ok) {
    return;
  }
  throw result.error instanceof Error
    ? result.error
    : new Error('Failed to save preference');
}

/** Upsert the active-tenant membership row (creates when missing). */
export async function upsertTenantMembershipPreferences(
  membershipPrefs: TenantMembershipPreferencesService,
  email: string,
  update: Record<string, unknown>,
  insertDefaults?: Record<string, unknown>
): Promise<void> {
  const result =
    insertDefaults === undefined
      ? await membershipPrefs.upsert(email, update)
      : await membershipPrefs.upsert(email, update, insertDefaults);
  throwIfUpsertFailed(result);
}

/** Update the active-tenant membership row; fails when no row exists. */
export async function updateTenantMembershipPreferencesOnly(
  membershipPrefs: TenantMembershipPreferencesService,
  email: string,
  update: Record<string, unknown>
): Promise<void> {
  const result = await membershipPrefs.updateOnly(email, update);
  throwIfUpsertFailed(result);
}
