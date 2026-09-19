export const CLIENT_UPGRADE_AUTO_RELOAD_KEY =
  'prayerapp.client-upgrade.auto-reloaded';

export const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.churchprayer.app';

export const IOS_APP_STORE_URL =
  'https://apps.apple.com/search?term=Prayer%20App';

export type ClientSurface = 'web' | 'native';

export interface ClientMinVersions {
  min_web_build: string | null;
  min_native_version: string | null;
}

export interface ClientVersionGateDecision {
  blocked: boolean;
  surface: ClientSurface | null;
  clientVersion: string;
  minVersion: string | null;
}

export function clientSurfaceFromPlatform(platform: string): ClientSurface {
  switch (platform) {
    case 'ios':
    case 'android':
      return 'native';
    default:
      return 'web';
  }
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

export function evaluateClientVersionGate(
  surface: ClientSurface,
  clientVersion: string,
  mins: ClientMinVersions | null | undefined
): ClientVersionGateDecision {
  let minVersion: string | null;
  switch (surface) {
    case 'native':
      minVersion = mins?.min_native_version ?? null;
      break;
    case 'web':
      minVersion = mins?.min_web_build ?? null;
      break;
    default: {
      const _exhaustive: never = surface;
      throw new Error(`Unhandled client surface: ${_exhaustive}`);
    }
  }
  const blocked = isClientBelowMin(clientVersion, minVersion);
  return {
    blocked,
    surface: blocked ? surface : null,
    clientVersion,
    minVersion: minVersion?.trim() || null,
  };
}

export function storeUrlForPlatform(platform: string): string {
  return platform === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
}

/** Auto-reload a stale web shell once per tab. Returns true if a reload was started. */
export function maybeAutoReloadWebOnce(options: {
  blocked: boolean;
  surface: ClientSurface;
  reload: () => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}): boolean {
  if (!options.blocked || options.surface !== 'web') {
    return false;
  }
  const storage =
    options.storage ??
    (typeof sessionStorage === 'undefined' ? null : sessionStorage);
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
