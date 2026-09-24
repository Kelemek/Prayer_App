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

import { Capacitor } from '@capacitor/core';

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

  it('uses session cache when cookie is absent', async () => {
    sessionStorage.setItem(
      ANALYTICS_GEO_SESSION_KEY,
      JSON.stringify({ region: 'open', country: 'US' })
    );

    const result = await resolveAnalyticsGeoRegion();

    expect(result).toEqual({ region: 'open', country: 'US' });
    expect(fetch).not.toHaveBeenCalled();
    expect(document.cookie).toContain(`${ANALYTICS_GEO_COOKIE}=open`);
  });

  it('ignores invalid session cache JSON', async () => {
    sessionStorage.setItem(ANALYTICS_GEO_SESSION_KEY, 'not-json');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ region: 'open', country: 'CA' }),
    } as Response);

    const result = await resolveAnalyticsGeoRegion();

    expect(result.country).toBe('CA');
  });

  it('fail-opens when API returns non-ok', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    expect(await resolveAnalyticsGeoRegion()).toEqual({ region: 'open', country: null });
  });

  it('uses native geo API URL on Capacitor', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ country: 'DE' }),
    } as Response);

    await resolveAnalyticsGeoRegion();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/geo$/),
      expect.any(Object)
    );
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
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
