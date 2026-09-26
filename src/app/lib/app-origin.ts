import { environment } from '../../environments/environment';
import { buildTenantOrigin } from './tenant-host';

/** Platform canonical origin from appUrl, or current browser origin. */
export function getPlatformOrigin(): string {
  const configured = environment.appUrl?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function hostnameFromOrigin(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) {
    return '';
  }
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

/**
 * Hostname used after the church slug in setup preview
 * (`https://{slug}.{suffix}`). Prefers configured tenant suffix, then a public
 * app host, then the current page host. Loopback hosts are skipped.
 */
export function resolveTenantHostSuffixForPreview(): string {
  const configured = environment.tenantHostSuffix?.trim().toLowerCase() ?? '';
  if (configured && !isLoopbackHost(configured)) {
    return configured;
  }
  const fromAppUrl = hostnameFromOrigin(environment.appUrl);
  if (fromAppUrl && !isLoopbackHost(fromAppUrl)) {
    return fromAppUrl;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host && !isLoopbackHost(host)) {
      return host;
    }
  }
  return 'prayer.romans8.net';
}

/** Origin for a tenant when subdomain mode is configured; else platform origin. */
export function getTenantOrigin(slug: string): string {
  const suffix = environment.tenantHostSuffix?.trim() ?? '';
  if (slug && suffix) {
    const tenantOrigin = buildTenantOrigin(
      slug,
      suffix,
      typeof window !== 'undefined' ? window.location.protocol : 'https:'
    );
    if (tenantOrigin) {
      return tenantOrigin;
    }
  }
  return getPlatformOrigin();
}

/** Origin safe for auth OTP redirect (current page when on a known web host). */
export function getAuthRedirectOrigin(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const origin = window.location.origin;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return origin;
  }
  const platformHosts = new Set(
    (environment.platformHosts ?? []).map((h) => h.toLowerCase())
  );
  if (platformHosts.has(host)) {
    return origin;
  }
  const suffix = environment.tenantHostSuffix?.trim().toLowerCase() ?? '';
  if (suffix && (host === suffix || host.endsWith(`.${suffix}`))) {
    return origin;
  }
  const configured = environment.appUrl?.trim();
  return configured ? configured.replace(/\/$/, '') : origin;
}

