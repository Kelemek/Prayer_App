import { describe, it, expect, vi } from 'vitest';
import {
  CAPACITOR_LIVE_ORIGIN,
  buildLiveRedirectUrl,
  isCapacitorBundledBootOrigin,
  isOnCapacitorLiveHost,
  maybeRedirectNativeToLiveSite,
  probeLiveOriginReachable,
  shouldAttemptLiveRedirect,
} from './capacitor-live-boot';

describe('capacitor-live-boot', () => {
  it('detects bundled Capacitor boot origins', () => {
    expect(isCapacitorBundledBootOrigin('capacitor://localhost', 'localhost')).toBe(
      true
    );
    expect(isCapacitorBundledBootOrigin('https://localhost', 'localhost')).toBe(
      true
    );
    expect(
      isCapacitorBundledBootOrigin('https://prayerapp.romans8.net', 'prayerapp.romans8.net')
    ).toBe(false);
    expect(isCapacitorBundledBootOrigin('http://10.0.2.2:4200', '10.0.2.2')).toBe(
      false
    );
  });

  it('detects live production host', () => {
    expect(isOnCapacitorLiveHost('prayerapp.romans8.net')).toBe(true);
    expect(isOnCapacitorLiveHost('tenant.prayer.romans8.net')).toBe(true);
    expect(isOnCapacitorLiveHost('localhost')).toBe(false);
  });

  it('shouldAttemptLiveRedirect only on native bundled boot', () => {
    expect(
      shouldAttemptLiveRedirect({
        isNative: false,
        origin: 'https://localhost',
        hostname: 'localhost',
      })
    ).toBe(false);
    expect(
      shouldAttemptLiveRedirect({
        isNative: true,
        origin: 'https://prayerapp.romans8.net',
        hostname: 'prayerapp.romans8.net',
      })
    ).toBe(false);
    expect(
      shouldAttemptLiveRedirect({
        isNative: true,
        origin: 'https://localhost',
        hostname: 'localhost',
      })
    ).toBe(true);
  });

  it('buildLiveRedirectUrl preserves path and query', () => {
    expect(
      buildLiveRedirectUrl(CAPACITOR_LIVE_ORIGIN, {
        pathname: '/info',
        search: '?x=1',
        hash: '#top',
      })
    ).toBe('https://prayerapp.romans8.net/info?x=1#top');
  });

  it('probeLiveOriginReachable returns true on ok HEAD', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await expect(
      probeLiveOriginReachable({
        liveOrigin: CAPACITOR_LIVE_ORIGIN,
        fetchFn,
        timeoutMs: 1000,
      })
    ).resolves.toBe(true);
  });

  it('maybeRedirectNativeToLiveSite replaces location when reachable', async () => {
    const replace = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    const redirected = await maybeRedirectNativeToLiveSite({
      isNative: true,
      origin: 'https://localhost',
      hostname: 'localhost',
      location: {
        pathname: '/',
        search: '',
        hash: '',
        replace,
      } as Location,
      liveOrigin: CAPACITOR_LIVE_ORIGIN,
      fetchFn,
      timeoutMs: 1000,
    });
    expect(redirected).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://prayerapp.romans8.net/');
  });

  it('stays on bundled origin when probe fails', async () => {
    const replace = vi.fn();
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    const redirected = await maybeRedirectNativeToLiveSite({
      isNative: true,
      origin: 'capacitor://localhost',
      hostname: 'localhost',
      location: {
        pathname: '/',
        search: '',
        hash: '',
        replace,
      } as Location,
      liveOrigin: CAPACITOR_LIVE_ORIGIN,
      fetchFn,
      timeoutMs: 1000,
    });
    expect(redirected).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});
