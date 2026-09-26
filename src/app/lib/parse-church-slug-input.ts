import { normalizeTenantSlug } from './tenant-slug';

/** Parse `{slug}.suffix` or a bare slug from user input. */
export function parseChurchSlugFromInput(
  raw: string,
  tenantHostSuffix: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const suffix = tenantHostSuffix.trim().toLowerCase();
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const host = url.hostname.toLowerCase();
    if (suffix && host.endsWith(`.${suffix}`)) {
      const prefix = host.slice(0, -(suffix.length + 1));
      if (prefix && !prefix.includes('.')) {
        return normalizeTenantSlug(prefix);
      }
    }
    if (suffix && host === suffix) {
      return null;
    }
  } catch {
    // not a URL — fall through to bare slug
  }

  const bare = normalizeTenantSlug(trimmed);
  return bare || null;
}
