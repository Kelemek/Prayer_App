/** Production site loaded when the native app is online (hybrid shell). */
export const CAPACITOR_LIVE_ORIGIN = 'https://prayerapp.romans8.net';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

/** True when the WebView booted from bundled assets (not dev server.url or live site). */
export function isCapacitorBundledBootOrigin(
  origin: string,
  hostname: string
): boolean {
  if (origin.startsWith('capacitor://')) {
    return true;
  }
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function isOnCapacitorLiveHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'prayerapp.romans8.net' || host.endsWith('.romans8.net');
}

export function shouldAttemptLiveRedirect(options: {
  isNative: boolean;
  origin: string;
  hostname: string;
}): boolean {
  if (!options.isNative) {
    return false;
  }
  if (isOnCapacitorLiveHost(options.hostname)) {
    return false;
  }
  return isCapacitorBundledBootOrigin(options.origin, options.hostname);
}

export function buildLiveRedirectUrl(
  liveOrigin: string,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
): string {
  const base = liveOrigin.replace(/\/$/, '');
  const path = location.pathname || '/';
  return `${base}${path}${location.search}${location.hash}`;
}

export async function probeLiveOriginReachable(options: {
  liveOrigin: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<boolean> {
  const url = `${options.liveOrigin.replace(/\/$/, '')}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchFn(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function maybeRedirectNativeToLiveSite(options: {
  isNative: boolean;
  origin: string;
  hostname: string;
  location: Location;
  liveOrigin: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<boolean> {
  if (
    !shouldAttemptLiveRedirect({
      isNative: options.isNative,
      origin: options.origin,
      hostname: options.hostname,
    })
  ) {
    return false;
  }

  const reachable = await probeLiveOriginReachable({
    liveOrigin: options.liveOrigin,
    fetchFn: options.fetchFn,
    timeoutMs: options.timeoutMs,
  });
  if (!reachable) {
    return false;
  }

  const target = buildLiveRedirectUrl(options.liveOrigin, options.location);
  options.location.replace(target);
  return true;
}
