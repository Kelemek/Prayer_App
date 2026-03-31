// Copy this file to environment.ts and fill in your Supabase credentials
// DO NOT commit environment.ts to version control

export const environment = {
  production: false,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'your-publishable-key',
  /** Public URL for links in emails (e.g. https://yourdomain.com). Leave empty to use current origin. Set for native/Capacitor builds so links are not capacitor://localhost. */
  appUrl: ''
};
