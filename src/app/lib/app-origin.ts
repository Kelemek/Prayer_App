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

/** Full invite claim URL for a tenant. */
export function buildTenantInviteUrl(slug: string, token: string): string {
  const base = getTenantOrigin(slug);
  const trimmedToken = token.trim();
  if (!base || !trimmedToken) {
    return '';
  }
  return `${base}/join/${encodeURIComponent(trimmedToken)}`;
}
