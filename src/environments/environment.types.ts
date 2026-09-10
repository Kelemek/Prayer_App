export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Platform canonical URL for links in emails and Capacitor builds. */
  appUrl: string;
  /** Hostnames that do not force a tenant (apex, www, preview aliases). */
  platformHosts: string[];
  /** Cookie Domain parent for shared auth across tenant subdomains, e.g. .prayer.romans8.net */
  cookieParentDomain: string;
  /** Suffix for church subdomains, e.g. prayer.romans8.net. Empty disables subdomain mode. */
  tenantHostSuffix: string;
}
