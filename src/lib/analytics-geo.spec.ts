import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAnalyticsConsentRegion,
  regionFromCountryCode,
} from './analytics-geo-region';
import {
  ANALYTICS_GEO_COOKIE,
  ANALYTICS_GEO_SESSION_KEY,
  resolveAnalyticsGeoRegion,
} from './analytics-geo';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('analytics-geo-region', () => {
  it('treats EU, UK, and EEA as consent_required', () => {
    expect(isAnalyticsConsentRegion('DE')).toBe(true);
    expect(isAnalyticsConsentRegion('fr')).toBe(true);
    expect(isAnalyticsConsentRegion('GB')).toBe(true);
    expect(isAnalyticsConsentRegion('NO')).toBe(true);
    expect(regionFromCountryCode('DE')).toBe('consent_required');
  });

  it('treats US, CA, AU, CH, and unknown as open', () => {
    expect(isAnalyticsConsentRegion('US')).toBe(false);
    expect(isAnalyticsConsentRegion('CA')).toBe(false);
    expect(isAnalyticsConsentRegion('AU')).toBe(false);
    expect(isAnalyticsConsentRegion('CH')).toBe(false);
    expect(isAnalyticsConsentRegion('')).toBe(false);
    expect(isAnalyticsConsentRegion(null)).toBe(false);
    expect(regionFromCountryCode('US')).toBe('open');
  });
});

describe('resolveAnalyticsGeoRegion', () => {
  beforeEach(() => {
    document.cookie = `${ANALYTICS_GEO_COOKIE}=; Path=/; Max-Age=0`;
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads region from cookie without fetch', async () => {
    document.cookie = `${ANALYTICS_GEO_COOKIE}=consent_required; Path=/`;
    sessionStorage.setItem(
      ANALYTICS_GEO_SESSION_KEY,
      JSON.stringify({ region: 'consent_required', country: 'DE' })
    );

    const result = await resolveAnalyticsGeoRegion();

    expect(result).toEqual({ region: 'consent_required', country: 'DE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fail-opens when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'));

    const result = await resolveAnalyticsGeoRegion();

    expect(result).toEqual({ region: 'open', country: null });
  });

  it('caches successful API response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ region: 'consent_required', country: 'FR' }),
    } as Response);

    const result = await resolveAnalyticsGeoRegion();

    expect(result).toEqual({ region: 'consent_required', country: 'FR' });
    expect(sessionStorage.getItem(ANALYTICS_GEO_SESSION_KEY)).toContain(
      'consent_required'
    );
    expect(document.cookie).toContain(`${ANALYTICS_GEO_COOKIE}=consent_required`);
  });
});
