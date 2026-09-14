import type { UserSettingsFacade } from './user-settings-facade';
import { describeFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';

export type AccountEraseMode = 'keep_prayers' | 'wipe_prayers';

export function closeUserSettingsDeleteAccountVerification(
  host: UserSettingsFacade
): void {
  if (!host.deletingAccount) {
    host.showDeleteAccountVerification = false;
    host.error = null;
    host.markForCheck();
  }
}

async function invokeDeleteAccount(
  host: UserSettingsFacade,
  mode: AccountEraseMode
): Promise<void> {
  const { data, error, response } = await host.deps.supabase.client.functions.invoke(
    'delete-account',
    { body: { mode } }
  );

  if (error) {
    throw new Error(
      await describeFunctionInvokeFailure(error, response, 'delete-account')
    );
  }

  if (!data || typeof data !== 'object' || (data as { success?: unknown }).success !== true) {
    const message =
      data &&
      typeof data === 'object' &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Could not delete account. Please try again.';
    throw new Error(message);
  }
}

export async function runUserSettingsDeleteAccountKeepPrayers(
  host: UserSettingsFacade
): Promise<void> {
  host.deletingAccount = true;
  host.error = null;
  host.markForCheck();
  try {
    await invokeDeleteAccount(host, 'keep_prayers');
    host.showDeleteAccountVerification = false;
    host.deletingAccount = false;
    host.markForCheck();
    await runUserSettingsLogout(host);
  } catch (err) {
    host.deletingAccount = false;
    host.error =
      err instanceof Error ? err.message : 'Could not delete account. Please try again.';
    host.showDeleteAccountVerification = false;
    host.markForCheck();
  }
}

export async function runUserSettingsDeleteAccountAndPrayers(
  host: UserSettingsFacade
): Promise<void> {
  host.deletingAccount = true;
  host.error = null;
  host.markForCheck();
  try {
    await invokeDeleteAccount(host, 'wipe_prayers');
    host.showDeleteAccountVerification = false;
    host.deletingAccount = false;
    host.markForCheck();
    await runUserSettingsLogout(host);
  } catch (err) {
    host.deletingAccount = false;
    host.error =
      err instanceof Error ? err.message : 'Could not delete account. Please try again.';
    host.showDeleteAccountVerification = false;
    host.markForCheck();
  }
}

export async function runUserSettingsLogout(
  host: UserSettingsFacade
): Promise<void> {
  await host.deps.adminAuthService.logout();
}
