import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_BECAME_VISIBLE_EVENT,
  installAppForegroundSignal,
  resetAppForegroundSignalForTests,
} from './app-foreground';

describe('installAppForegroundSignal', () => {
  afterEach(() => {
    resetAppForegroundSignalForTests();
    vi.restoreAllMocks();
  });

  function visible(): void {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  }

  it('dispatches app-became-visible once per coalesced visibility edge', () => {
    let now = 1_000_000;
    const onVisible = vi.fn();
    window.addEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
    installAppForegroundSignal({ now: () => now, coalesceMs: 750 });
    visible();

    document.dispatchEvent(new Event('visibilitychange'));
    now += 100;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onVisible).toHaveBeenCalledTimes(1);

    now += 800;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onVisible).toHaveBeenCalledTimes(2);

    window.removeEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
  });

  it('does not dispatch on focus or while the document is hidden', () => {
    const onVisible = vi.fn();
    window.addEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
    installAppForegroundSignal({ now: () => 5_000, coalesceMs: 750 });

    window.dispatchEvent(new Event('focus'));
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onVisible).not.toHaveBeenCalled();
    window.removeEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
  });

  it('skips dispatch when the shell gate returns false and retries later', () => {
    let allow = false;
    let now = 10_000;
    const onVisible = vi.fn();
    window.addEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
    installAppForegroundSignal({
      now: () => now,
      coalesceMs: 750,
      shouldDispatch: () => allow,
    });
    visible();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(onVisible).not.toHaveBeenCalled();

    allow = true;
    now += 10;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onVisible).toHaveBeenCalledTimes(1);
    window.removeEventListener(APP_BECAME_VISIBLE_EVENT, onVisible);
  });
});
