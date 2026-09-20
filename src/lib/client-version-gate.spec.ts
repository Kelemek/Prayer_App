import { describe, it, expect, vi } from 'vitest';
import { APP_BUNDLE_VERSION } from './app-analytics-context';
import {
  ANDROID_PLAY_STORE_URL,
  CLIENT_UPGRADE_AUTO_RELOAD_KEY,
  FORCE_UPGRADE_OFFLINE_REFRESH_BODY,
  FORCE_UPGRADE_REFRESH_BODY,
  IOS_APP_STORE_URL,
  clientSurfaceFromPlatform,
  compareClientVersions,
  evaluateClientVersionGate,
  forceUpgradeBodyForDecision,
  isClientBelowMin,
  maybeAutoReloadWebOnce,
  normalizeMinVersionsRow,
  parseVersionParts,
  storeUrlForPlatform,
} from './client-version-gate';

describe('client-version-gate', () => {
  describe('parseVersionParts / compareClientVersions', () => {
    it('parses dotted semver and plain build numbers', () => {
      expect(parseVersionParts('1.12.0')).toEqual([1, 12, 0]);
      expect(parseVersionParts('15')).toEqual([15]);
      expect(parseVersionParts(' 1.0 ')).toEqual([1, 0]);
    });

    it('orders versions numerically', () => {
      expect(compareClientVersions('1.0', '1.1')).toBe(-1);
      expect(compareClientVersions('1.1', '1.0')).toBe(1);
      expect(compareClientVersions('1.0.0', '1.0')).toBe(0);
      expect(compareClientVersions('2', '1.15')).toBe(1);
    });
  });

  describe('isClientBelowMin', () => {
    it('does not block when min or client is unset', () => {
      expect(isClientBelowMin('1.0', null)).toBe(false);
      expect(isClientBelowMin('1.0', '')).toBe(false);
      expect(isClientBelowMin('', '2.0')).toBe(false);
      expect(isClientBelowMin(null, '2.0')).toBe(false);
    });

    it('blocks only when the client is strictly below the floor', () => {
      expect(isClientBelowMin('1.0', '1.1')).toBe(true);
      expect(isClientBelowMin('1.1', '1.1')).toBe(false);
      expect(isClientBelowMin('1.2', '1.1')).toBe(false);
    });
  });

  describe('evaluateClientVersionGate', () => {
    it('uses min_web_build for refresh on web and native', () => {
      const mins = { min_web_build: '2.0', min_native_version: '3.0' };
      expect(evaluateClientVersionGate('web', '1.0', mins)).toEqual({
        blocked: true,
        upgradeKind: 'refresh',
        surface: 'web',
        clientVersion: '1.0',
        minVersion: '2.0',
      });
      expect(evaluateClientVersionGate('native', '1.0', mins)).toMatchObject({
        blocked: true,
        upgradeKind: 'refresh',
        surface: 'native',
      });
    });

    it('blocks native binary below min_native_version with store upgrade', () => {
      const mins = { min_web_build: null, min_native_version: '2.0' };
      expect(
        evaluateClientVersionGate('native', '1.0', mins, '1.12')
      ).toMatchObject({
        blocked: true,
        upgradeKind: 'store',
        clientVersion: '1.12',
        minVersion: '2.0',
      });
    });

    it('prefers store block when both binary and JS are below floor', () => {
      const mins = { min_web_build: '9.0', min_native_version: '2.0' };
      expect(
        evaluateClientVersionGate('native', '1.0', mins, '1.0')
      ).toMatchObject({
        blocked: true,
        upgradeKind: 'store',
      });
    });

    it('leaves current clients through when mins are unset', () => {
      expect(
        evaluateClientVersionGate('web', APP_BUNDLE_VERSION, {
          min_web_build: null,
          min_native_version: null,
        }).blocked
      ).toBe(false);
      expect(
        evaluateClientVersionGate('native', APP_BUNDLE_VERSION, null, '1.15')
          .blocked
      ).toBe(false);
    });
  });

  describe('forceUpgradeBodyForDecision', () => {
    it('uses offline copy on bundled Capacitor origin for refresh blocks', () => {
      expect(
        forceUpgradeBodyForDecision(
          {
            blocked: true,
            upgradeKind: 'refresh',
            surface: 'native',
            clientVersion: '1.0',
            minVersion: '2.0',
          },
          { onBundledCapacitorOrigin: true }
        )
      ).toBe(FORCE_UPGRADE_OFFLINE_REFRESH_BODY);
      expect(
        forceUpgradeBodyForDecision(
          {
            blocked: true,
            upgradeKind: 'refresh',
            surface: 'web',
            clientVersion: '1.0',
            minVersion: '2.0',
          },
          { onBundledCapacitorOrigin: false }
        )
      ).toBe(FORCE_UPGRADE_REFRESH_BODY);
    });
  });

  describe('maybeAutoReloadWebOnce', () => {
    it('reloads a blocked refresh client once per storage', () => {
      const reload = vi.fn();
      const storage = new Map<string, string>();
      const store = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      };

      expect(
        maybeAutoReloadWebOnce({
          blocked: true,
          upgradeKind: 'refresh',
          reload,
          storage: store,
        })
      ).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(storage.get(CLIENT_UPGRADE_AUTO_RELOAD_KEY)).toBe('1');

      expect(
        maybeAutoReloadWebOnce({
          blocked: true,
          upgradeKind: 'refresh',
          reload,
          storage: store,
        })
      ).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not auto-reload store upgrade blocks', () => {
      const reload = vi.fn();
      expect(
        maybeAutoReloadWebOnce({
          blocked: true,
          upgradeKind: 'store',
          reload,
        })
      ).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    });
  });

  it('normalizes RPC array or object rows', () => {
    expect(
      normalizeMinVersionsRow([
        { min_web_build: '1.2', min_native_version: '1.3' },
      ])
    ).toEqual({ min_web_build: '1.2', min_native_version: '1.3' });
    expect(normalizeMinVersionsRow({ min_web_build: '2.0' })).toEqual({
      min_web_build: '2.0',
      min_native_version: null,
    });
    expect(normalizeMinVersionsRow(null)).toBeNull();
  });

  it('narrows Capacitor platforms and store URLs', () => {
    expect(clientSurfaceFromPlatform('ios')).toBe('native');
    expect(clientSurfaceFromPlatform('android')).toBe('native');
    expect(clientSurfaceFromPlatform('web')).toBe('web');
    expect(storeUrlForPlatform('ios')).toBe(IOS_APP_STORE_URL);
    expect(storeUrlForPlatform('android')).toBe(ANDROID_PLAY_STORE_URL);
  });
});
