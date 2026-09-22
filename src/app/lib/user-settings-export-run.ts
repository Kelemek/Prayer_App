import { Capacitor } from '@capacitor/core';
import type { UserSettingsFacade } from './user-settings-facade';

export interface ExportUserAccountPayload {
  schema_version: 1;
  account: Record<string, unknown>;
  memberships: unknown;
  preferences: Record<string, unknown>;
  prayers: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Rejects garbage RPC bodies. Not a full schema validator. */
export function isExportUserAccountPayload(
  value: unknown
): value is ExportUserAccountPayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value['schema_version'] === 1 &&
    isRecord(value['account']) &&
    isRecord(value['memberships']) &&
    isRecord(value['preferences']) &&
    isRecord(value['prayers'])
  );
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** iOS WKWebView ignores `<a download>`. The share sheet can save the file. */
const NATIVE_SHARE_FILE_TYPES = ['application/json', 'text/plain'] as const;

export type AccountExportDelivery = 'saved' | 'needs-gesture';

function isNativeMobileApp(): boolean {
  try {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  } catch {
    return false;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isGestureError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'InvalidStateError')
  );
}

function fileForNativeShare(filename: string, json: string): File | null {
  if (typeof navigator.canShare !== 'function') {
    return null;
  }
  for (const type of NATIVE_SHARE_FILE_TYPES) {
    const file = new File([json], filename, { type });
    try {
      if (navigator.canShare({ files: [file] })) {
        return file;
      }
    } catch {
      // canShare throws when the browser rejects the payload shape
    }
  }
  return null;
}

async function shareAccountExport(
  filename: string,
  json: string
): Promise<AccountExportDelivery> {
  const file = fileForNativeShare(filename, json);
  try {
    if (file) {
      await navigator.share({ files: [file], title: filename });
      return 'saved';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: filename, text: json });
      return 'saved';
    }
  } catch (error) {
    if (isAbortError(error)) {
      return 'saved';
    }
    if (isGestureError(error)) {
      return 'needs-gesture';
    }
    throw error;
  }
  throw new Error('Could not open the save sheet on this device. Please try again.');
}

export async function saveAccountExport(
  filename: string,
  data: unknown
): Promise<AccountExportDelivery> {
  if (!isNativeMobileApp()) {
    downloadJsonFile(filename, data);
    return 'saved';
  }
  return shareAccountExport(filename, JSON.stringify(data, null, 2));
}

export function exportUserAccountFilename(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `prayer-app-data-export-${date}.json`;
}

export async function runUserSettingsDownloadMyData(
  host: UserSettingsFacade,
  deliver: (
    filename: string,
    data: unknown
  ) => void | Promise<void | AccountExportDelivery> = saveAccountExport
): Promise<void> {
  if (host.exportingAccount) {
    return;
  }

  if (host.pendingAccountExport) {
    const pending = host.pendingAccountExport;
    host.error = null;
    host.markForCheck();
    try {
      const result = await deliver(pending.filename, pending.data);
      if (result !== 'needs-gesture') {
        host.pendingAccountExport = null;
      }
    } catch (err) {
      host.error =
        err instanceof Error ? err.message : 'Could not export your data. Please try again.';
    } finally {
      host.markForCheck();
    }
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

    const filename = exportUserAccountFilename();
    const result = await deliver(filename, data);
    host.pendingAccountExport = result === 'needs-gesture' ? { filename, data } : null;
  } catch (err) {
    host.pendingAccountExport = null;
    host.error =
      err instanceof Error ? err.message : 'Could not export your data. Please try again.';
  } finally {
    host.exportingAccount = false;
    host.markForCheck();
  }
}
