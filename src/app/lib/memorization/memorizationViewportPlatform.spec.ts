import { describe, it, expect, afterEach } from 'vitest';
import {
  isMemorizeAndroidWebHost,
  isMemorizeIosWebHost,
  isProfileResourceListenControlAvailable,
  isProfileResourceSearchContentTouchBlurHost,
} from './memorizationViewportPlatform';

describe('memorizationViewportPlatform', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('detects Android hosts', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Linux; Android 14)' },
      configurable: true,
    });
    expect(isMemorizeAndroidWebHost()).toBe(true);
    expect(isProfileResourceListenControlAvailable()).toBe(false);
    expect(isProfileResourceSearchContentTouchBlurHost()).toBe(true);
  });

  it('detects iOS hosts', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
      configurable: true,
    });
    expect(isMemorizeIosWebHost()).toBe(true);
    expect(isProfileResourceSearchContentTouchBlurHost()).toBe(true);
  });

  it('treats desktop as non-mobile host', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
      configurable: true,
    });
    expect(isMemorizeAndroidWebHost()).toBe(false);
    expect(isMemorizeIosWebHost()).toBe(false);
    expect(isProfileResourceListenControlAvailable()).toBe(true);
  });
});
