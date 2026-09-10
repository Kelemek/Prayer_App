import { environment } from '../../environments/environment';
import {
  buildTenantNavigationUrl,
  isSubdomainNavigationEnabled,
  normalizeHostname,
} from './tenant-host';

function isNativeCapacitor(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

/** Whether switching to another tenant should navigate to its subdomain. */
export function shouldNavigateToTenantSubdomain(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '');
  return isSubdomainNavigationEnabled(
    host,
    {
      platformHosts: environment.platformHosts ?? [],
      tenantHostSuffix: environment.tenantHostSuffix ?? '',
    },
    isNativeCapacitor()
  );
}

/**
 * Switch tenant: navigate to subdomain when configured, else invoke in-place switch.
 * Returns true if navigation was started (caller should not await further work).
 */
export async function switchTenantWithNavigation(
  tenantId: string,
  slug: string,
  switchInPlace: (id: string) => Promise<boolean>
): Promise<'navigated' | 'switched' | 'failed'> {
  const suffix = environment.tenantHostSuffix?.trim() ?? '';
  if (!shouldNavigateToTenantSubdomain()) {
    const ok = await switchInPlace(tenantId);
    return ok ? 'switched' : 'failed';
  }

  const currentHost =
    typeof window !== 'undefined' ? normalizeHostname(window.location.hostname) : '';
  const targetHost = normalizeHostname(`${slug}.${suffix}`);

  if (currentHost === targetHost) {
    const ok = await switchInPlace(tenantId);
    return ok ? 'switched' : 'failed';
  }

  const url = buildTenantNavigationUrl(
    slug,
    suffix,
    typeof window !== 'undefined'
      ? {
          pathname: window.location.pathname,
          search: window.location.search,
          protocol: window.location.protocol,
        }
      : undefined
  );
  if (!url) {
    const ok = await switchInPlace(tenantId);
    return ok ? 'switched' : 'failed';
  }

  if (typeof window !== 'undefined') {
    window.location.assign(url);
    return 'navigated';
  }

  const ok = await switchInPlace(tenantId);
  return ok ? 'switched' : 'failed';
}
