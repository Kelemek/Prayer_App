import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.churchprayer.app',
  appName: 'Prayer App',
  webDir: 'dist/prayerapp/browser',
  plugins: {
    Badge: {
      persist: true,
      // Locked: app open / resume must not clear the icon badge.
      autoClear: false,
    },
  },
};

export default config;
