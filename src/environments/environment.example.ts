// Copy this file to environment.ts and fill in your Supabase credentials
// DO NOT commit environment.ts to version control

import {
  normalizeCookieParentDomain,
  normalizeTenantHostSuffix,
  parsePlatformHosts,
} from './environment-config';
import type { AppEnvironment } from './environment.types';

export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'your-publishable-key',
  /** Public URL for links in emails (e.g. https://yourdomain.com). Leave empty to use current origin. Set for native/Capacitor builds so links are not capacitor://localhost. */
  appUrl: import.meta.env.VITE_APP_URL || '',
  platformHosts: parsePlatformHosts(import.meta.env.VITE_PLATFORM_HOSTS),
  cookieParentDomain: normalizeCookieParentDomain(
    import.meta.env.VITE_COOKIE_PARENT_DOMAIN
  ),
  tenantHostSuffix: normalizeTenantHostSuffix(import.meta.env.VITE_TENANT_HOST_SUFFIX),
  posthogKey: import.meta.env.VITE_POSTHOG_KEY || '',
  posthogHost: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  posthogUiHost: import.meta.env.VITE_POSTHOG_UI_HOST || 'https://us.posthog.com',
};
