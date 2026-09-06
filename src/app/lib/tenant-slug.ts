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
