/**
 * Reserved tenant slugs — keep in sync with supabase/migrations/*_reserved_tenant_slugs.sql
 * and create_tenant_for_user.
 */
export const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "prayer",
  "ftp",
  "cdn",
  "static",
  "auth",
  "login",
  "status",
  "smtp",
  "staging",
  "preview",
  "offline",
  "personal",
  "platform",
]);

const DNS_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Normalize a tenant slug the same way the create-tenant RPC does. */
export function normalizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Suggest a slug from a church or organization name. */
export function suggestTenantSlugFromName(name: string): string {
  return normalizeTenantSlug(name);
}

/** Whether a normalized slug is allowed for tenant creation. */
export function isAllowedTenantSlug(slug: string): boolean {
  const normalized = normalizeTenantSlug(slug);
  if (!normalized) {
    return false;
  }
  if (RESERVED_TENANT_SLUGS.has(normalized)) {
    return false;
  }
  return DNS_LABEL_PATTERN.test(normalized);
}

/** Human-readable validation error for slug input, or null when valid. */
export function validateTenantSlug(slug: string): string | null {
  const normalized = normalizeTenantSlug(slug);
  if (!normalized) {
    return "Slug is required";
  }
  if (RESERVED_TENANT_SLUGS.has(normalized)) {
    return "This slug is reserved and cannot be used";
  }
  if (!DNS_LABEL_PATTERN.test(normalized)) {
    return "Slug must use lowercase letters, numbers, and hyphens (DNS-safe)";
  }
  return null;
}
