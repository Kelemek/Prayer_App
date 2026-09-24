/** Production web app URL when VITE_APP_URL / environment.appUrl is unset. */
export const DEFAULT_PUBLIC_APP_URL = 'https://prayerapp.romans8.net';

/** In-app support page. Contact copy should point here, not a placeholder inbox. */
export const SUPPORT_PAGE_PATH = '/support';

export function supportPageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}${SUPPORT_PAGE_PATH}`;
}

export const APP_DISPLAY_NAME = 'Prayer App';

/** PWA icon served from public/icons (see cap:icons scripts). */
export const APP_ICON_PATH = '/icons/icon-192.webp';
