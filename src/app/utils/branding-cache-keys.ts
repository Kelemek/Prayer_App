export const ACTIVE_TENANT_STORAGE_KEY = 'active_tenant_id';

export const BRANDING_CACHE_KEYS = {
  lightLogo: 'branding_light_logo',
  darkLogo: 'branding_dark_logo',
  useLogo: 'branding_use_logo',
  appTitle: 'branding_app_title',
  appSubtitle: 'branding_app_subtitle',
  lastModified: 'branding_last_modified',
} as const;

export function getBrandingCacheKey(
  base: string,
  tenantId?: string | null
): string {
  const id =
    tenantId ??
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY)
      : null);
  return id ? `${base}:${id}` : base;
}
