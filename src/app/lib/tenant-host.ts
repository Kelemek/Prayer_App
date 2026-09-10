import { normalizeTenantSlug } from './tenant-slug';

export interface TenantHostConfig {
  platformHosts: string[];
  tenantHostSuffix: string;
}

export type ParsedHost =
  | { kind: 'platform' }
  | { kind: 'tenant'; slug: string }
  | { kind: 'tenant'; tenantId: string; slug?: string }
  | { kind: 'unknown' };

const DNS_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Strip port and lowercase a hostname. */
export function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  const colonIndex = trimmed.indexOf(':');
  return colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
}

/** Whether a label is a valid DNS hostname segment for tenant slugs. */
export function isDnsSafeSlugLabel(label: string): boolean {
  if (!label || label.length > 63) {
    return false;
  }
  return DNS_LABEL_PATTERN.test(label);
}

/**
 * Pure host parser: platform | tenant (slug or future tenantId) | unknown.
 * Unknown hosts behave like platform at runtime (no forced tenant).
 */
export function parseHost(
  hostname: string,
  config: TenantHostConfig,
  exactHostToTenantId: Readonly<Record<string, string>> = {}
): ParsedHost {
  const host = normalizeHostname(hostname);
  if (!host) {
    return { kind: 'unknown' };
  }

  const platformHosts = new Set(
    config.platformHosts.map((h) => normalizeHostname(h))
  );
  if (platformHosts.has(host)) {
    return { kind: 'platform' };
  }

  const exactTenantId = exactHostToTenantId[host];
  if (exactTenantId) {
    return { kind: 'tenant', tenantId: exactTenantId };
  }

  const suffix = config.tenantHostSuffix.trim().toLowerCase();
  if (suffix) {
    const suffixWithDot = `.${suffix}`;
    if (host.endsWith(suffixWithDot)) {
      const prefix = host.slice(0, -suffixWithDot.length);
      if (prefix && !prefix.includes('.') && isDnsSafeSlugLabel(prefix)) {
        return { kind: 'tenant', slug: prefix };
      }
    }
  }

  return { kind: 'unknown' };
}

export function isTenantSlugHost(parsed: ParsedHost): parsed is { kind: 'tenant'; slug: string } {
  return parsed.kind === 'tenant' && 'slug' in parsed && typeof parsed.slug === 'string';
}

export function isPlatformLikeHost(parsed: ParsedHost): boolean {
  return parsed.kind === 'platform' || parsed.kind === 'unknown';
}

/** Build origin for a tenant subdomain, e.g. https://cross-pointe.prayer.romans8.net */
export function buildTenantOrigin(
  slug: string,
  tenantHostSuffix: string,
  protocol: string = 'https:'
): string {
  const normalizedSlug = normalizeTenantSlug(slug);
  const suffix = tenantHostSuffix.trim().toLowerCase();
  if (!normalizedSlug || !suffix) {
    return '';
  }
  const proto = protocol.endsWith(':') ? protocol : `${protocol}:`;
  return `${proto}//${normalizedSlug}.${suffix}`;
}

/** Whether the current host is the platform apex or a tenant under the configured suffix. */
export function isUnderTenantHostSuffix(hostname: string, tenantHostSuffix: string): boolean {
  const host = normalizeHostname(hostname);
  const suffix = tenantHostSuffix.trim().toLowerCase();
  if (!host || !suffix) {
    return false;
  }
  return host === suffix || host.endsWith(`.${suffix}`);
}

/**
 * Subdomain navigation is enabled when suffix is configured and the browser is on a
 * platform host or tenant host under that suffix (not Capacitor / arbitrary hosts).
 */
export function isSubdomainNavigationEnabled(
  hostname: string,
  config: TenantHostConfig,
  isNativeApp: boolean
): boolean {
  if (isNativeApp || !config.tenantHostSuffix.trim()) {
    return false;
  }
  const host = normalizeHostname(hostname);
  const platformHosts = new Set(
    config.platformHosts.map((h) => normalizeHostname(h))
  );
  if (platformHosts.has(host)) {
    return true;
  }
  return isUnderTenantHostSuffix(host, config.tenantHostSuffix);
}

/** Whether shared auth cookies should be used for this hostname. */
export function shouldUseCookieParentDomain(
  hostname: string,
  cookieParentDomain: string,
  tenantHostSuffix: string
): boolean {
  const parent = cookieParentDomain.trim();
  if (!parent) {
    return false;
  }
  return isUnderTenantHostSuffix(hostname, tenantHostSuffix);
}

/** Navigate to tenant origin preserving path and query. */
export function buildTenantNavigationUrl(
  slug: string,
  tenantHostSuffix: string,
  currentLocation?: { pathname: string; search: string; protocol: string }
): string {
  const origin = buildTenantOrigin(
    slug,
    tenantHostSuffix,
    currentLocation?.protocol ?? 'https:'
  );
  if (!origin) {
    return '';
  }
  const path = currentLocation?.pathname ?? '/';
  const search = currentLocation?.search ?? '';
  return `${origin}${path}${search}`;
}
