import { APP_BUNDLE_VERSION } from './app-analytics-context';

export const CLIENT_UPGRADE_AUTO_RELOAD_KEY =
  'prayerapp.client-upgrade.auto-reloaded';

export const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.churchprayer.app';

export const IOS_APP_STORE_URL =
  'https://apps.apple.com/search?term=Prayer%20App';

export type ClientVersionPlatform = 'web' | 'ios' | 'android' | string;

export interface ClientMinVersions {
  min_web_build: string | null;
  min_native_version: string | null;
}

export interface ClientVersionGateDecision {
  blocked: boolean;
  surface: 'web' | 'native' | null;
  clientVersion: string;
  minVersion: string | null;
}

/** Split semver or dotted/build strings into numeric parts (`1.12.0`, `15`). */
export function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .split(/[.+_-]/)
    .map((part) => {
      const digits = part.replace(/\D/g, '');
      if (!digits) {
        return 0;
      }
      const n = Number.parseInt(digits, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

export function compareClientVersions(a: string, b: string): number {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const da = left[i] ?? 0;
    const db = right[i] ?? 0;
    if (da < db) {
      return -1;
    }
    if (da > db) {
      return 1;
    }
  }
  return 0;
}

export function isClientBelowMin(
  clientVersion: string | null | undefined,
  minVersion: string | null | undefined
): boolean {
  const client = clientVersion?.trim() ?? '';
  const min = minVersion?.trim() ?? '';
  if (!client || !min) {
    return false;
  }
  return compareClientVersions(client, min) < 0;
}

export function isNativeClientPlatform(platform: ClientVersionPlatform): boolean {
  return platform === 'ios' || platform === 'android';
}

export function evaluateClientVersionGate(
  platform: ClientVersionPlatform,
  clientVersion: string,
  mins: ClientMinVersions | null | undefined
): ClientVersionGateDecision {
  const native = isNativeClientPlatform(platform);
  const minVersion = native
    ? mins?.min_native_version ?? null
    : mins?.min_web_build ?? null;
  const blocked = isClientBelowMin(clientVersion, minVersion);
  return {
    blocked,
    surface: blocked ? (native ? 'native' : 'web') : null,
    clientVersion,
    minVersion: minVersion?.trim() || null,
  };
}

export function resolveClientVersion(
  _platform: ClientVersionPlatform
): string {
  return APP_BUNDLE_VERSION;
}

export function storeUrlForPlatform(platform: ClientVersionPlatform): string {
  if (platform === 'ios') {
    return IOS_APP_STORE_URL;
  }
  return ANDROID_PLAY_STORE_URL;
}

/** Auto-reload a stale web shell once per tab. Returns true if a reload was started. */
export function maybeAutoReloadWebOnce(options: {
  blocked: boolean;
  platform: ClientVersionPlatform;
  reload: () => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}): boolean {
  if (!options.blocked || options.platform !== 'web') {
    return false;
  }
  const storage = options.storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!storage) {
    return false;
  }
  try {
    if (storage.getItem(CLIENT_UPGRADE_AUTO_RELOAD_KEY) === '1') {
      return false;
    }
    storage.setItem(CLIENT_UPGRADE_AUTO_RELOAD_KEY, '1');
    options.reload();
    return true;
  } catch {
    return false;
  }
}

export function normalizeMinVersionsRow(
  data: unknown
): ClientMinVersions | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return null;
  }
  const record = row as Record<string, unknown>;
  const minWeb =
    typeof record['min_web_build'] === 'string' ? record['min_web_build'] : null;
  const minNative =
    typeof record['min_native_version'] === 'string'
      ? record['min_native_version']
      : null;
  return {
    min_web_build: minWeb,
    min_native_version: minNative,
  };
}
