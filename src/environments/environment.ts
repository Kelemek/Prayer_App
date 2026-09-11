import type { AppEnvironment } from './environment.types';

export const environment: AppEnvironment = {
  production: false,
  supabaseUrl: 'https://vjvanphgxtaoxgtxbngf.supabase.co',
  supabasePublishableKey: 'sb_publishable_sGVaX560zsw7POvKwX-z_Q_mg0AQunI',
  /** Public URL for links in emails (e.g. https://yourdomain.com). Leave empty to use current origin. Required for native/Capacitor so links are not capacitor://localhost. */
  appUrl: 'http://localhost:4200',
  platformHosts: ['localhost', '127.0.0.1'],
  cookieParentDomain: '',
  tenantHostSuffix: '',
  posthogKey: '',
  posthogHost: 'https://us.i.posthog.com',
  posthogUiHost: 'https://us.posthog.com',
};
