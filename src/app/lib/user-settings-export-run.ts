import type { UserSettingsFacade } from './user-settings-facade';
import {
  isExportUserAccountPayload,
} from './export-user-account-scope';

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportUserAccountFilename(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `prayer-app-data-export-${date}.json`;
}

export async function runUserSettingsDownloadMyData(
  host: UserSettingsFacade,
  download: typeof downloadJsonFile = downloadJsonFile
): Promise<void> {
  if (host.exportingAccount) {
    return;
  }

  host.exportingAccount = true;
  host.error = null;
  host.markForCheck();

  try {
    const { data, error } = await host.deps.supabase.client.rpc('export_user_account');

    if (error) {
      throw new Error(error.message || 'Could not export your data. Please try again.');
    }

    if (!isExportUserAccountPayload(data)) {
      throw new Error('Could not export your data. Please try again.');
    }

    download(exportUserAccountFilename(), data);
  } catch (err) {
    host.error =
      err instanceof Error ? err.message : 'Could not export your data. Please try again.';
  } finally {
    host.exportingAccount = false;
    host.markForCheck();
  }
}
