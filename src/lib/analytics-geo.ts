import { Capacitor } from '@capacitor/core';
import { environment } from '../environments/environment';
import { DEFAULT_PUBLIC_APP_URL } from '../app/constants/app-defaults';
import {
  type AnalyticsGeoRegion,
  regionFromCountryCode,
} from './analytics-geo-region';

export const ANALYTICS_GEO_COOKIE = 'prayerapp.analytics_geo';
export const ANALYTICS_GEO_SESSION_KEY = 'prayerapp.analytics_geo_session';

const GEO_FETCH_TIMEOUT_MS = 5000;

export type AnalyticsGeoResult = {
  region: AnalyticsGeoRegion;
  country: string | null;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readGeoCookie(): AnalyticsGeoRegion | null {
  if (!isBrowser()) {
    return null;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${ANALYTICS_GEO_COOKIE}=([^;]*)`)
  );
  const raw = match?.[1]?.trim();
  if (raw === 'consent_required' || raw === 'open') {
    return raw;
  }
  return null;
}

function readGeoSessionCache(): AnalyticsGeoResult | null {
  if (!isBrowser() || typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(ANALYTICS_GEO_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AnalyticsGeoResult;
    if (parsed.region === 'consent_required' || parsed.region === 'open') {
      return {
        region: parsed.region,
        country: typeof parsed.country === 'string' ? parsed.country : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeGeoSessionCache(result: AnalyticsGeoResult): void {
  if (!isBrowser() || typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(ANALYTICS_GEO_SESSION_KEY, JSON.stringify(result));
  } catch {
    // ignore quota / private mode
  }
}

function setGeoCookie(region: AnalyticsGeoRegion): void {
  if (!isBrowser()) {
    return;
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANALYTICS_GEO_COOKIE}=${region}; Path=/; SameSite=Lax${secure}`;
}

function getGeoApiUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const appUrl = environment.appUrl?.trim();
    const base =
      appUrl && appUrl.startsWith('https://')
        ? appUrl.replace(/\/$/, '')
        : DEFAULT_PUBLIC_APP_URL.replace(/\/$/, '');
    return `${base}/api/geo`;
  }
  return '/api/geo';
}

async function fetchGeoFromApi(): Promise<AnalyticsGeoResult | null> {
  if (!isBrowser()) {
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(getGeoApiUrl(), {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      region?: string;
      country?: string | null;
    };
    const region =
      body.region === 'consent_required' || body.region === 'open'
        ? body.region
        : regionFromCountryCode(body.country ?? null);
    const result: AnalyticsGeoResult = {
      region,
      country:
        typeof body.country === 'string' && body.country.length > 0
          ? body.country.toUpperCase()
          : null,
    };
    setGeoCookie(result.region);
    writeGeoSessionCache(result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** VPN/proxy may report a different country than the user's physical location. */
export async function resolveAnalyticsGeoRegion(): Promise<AnalyticsGeoResult> {
  const fromCookie = readGeoCookie();
  if (fromCookie) {
    const cached = readGeoSessionCache();
    return {
      region: fromCookie,
      country: cached?.country ?? null,
    };
  }

  const fromSession = readGeoSessionCache();
  if (fromSession) {
    setGeoCookie(fromSession.region);
    return fromSession;
  }

  const fromApi = await fetchGeoFromApi();
  if (fromApi) {
    return fromApi;
  }

  return { region: 'open', country: null };
}
