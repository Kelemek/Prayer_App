import { Capacitor } from '@capacitor/core';

/**
 * Marketing version of the running JS bundle.
 * Keep in sync with iOS `MARKETING_VERSION` and Android `versionName` when shipping a store release.
 */
export const APP_BUNDLE_VERSION = '1.0';

export interface AppAnalyticsContext {
  app_version: string;
  app_platform: string;
  app_environment: 'production' | 'development';
  tenant_id?: string;
  tenant_slug?: string;
  [key: string]: string | undefined;
}

export function getAppAnalyticsContext(
  production: boolean,
  tenant?: { id: string; slug: string } | null
): AppAnalyticsContext {
  const context: AppAnalyticsContext = {
    app_version: APP_BUNDLE_VERSION,
    app_platform: Capacitor.getPlatform(),
    app_environment: production ? 'production' : 'development',
  };
  if (tenant?.id) {
    context.tenant_id = tenant.id;
  }
  if (tenant?.slug) {
    context.tenant_slug = tenant.slug;
  }
  return context;
}
