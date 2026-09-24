import { describe, expect, it, vi } from 'vitest';
import {
  clearTimeoutIdMap,
  readNonEmptyPrayerCache,
  resetInactivityTimeout,
  scheduleDebouncedResumeRefresh,
  unsubscribePrayerResumeListeners,
  wirePrayerResumeListeners,
} from './prayer-service-resume';

describe('prayer-service-resume', () => {
  it('scheduleDebouncedResumeRefresh clears prior timeout', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();

    const t1 = scheduleDebouncedResumeRefresh(null, 400, first);
    const t2 = scheduleDebouncedResumeRefresh(t1, 400, second);

    vi.advanceTimersByTime(400);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('readNonEmptyPrayerCache returns null for empty or throwing reads', () => {
    expect(readNonEmptyPrayerCache(() => [])).toBeNull();
    expect(readNonEmptyPrayerCache(() => [{ id: 'p1' } as never])).toEqual([{ id: 'p1' }]);
    expect(readNonEmptyPrayerCache(() => { throw new Error('fail'); })).toBeNull();
  });

  it('clearTimeoutIdMap clears every entry', () => {
    vi.useFakeTimers();
    const map = new Map<string, number>();
    map.set('a', setTimeout(() => {}, 1000) as unknown as number);
    map.set('b', setTimeout(() => {}, 1000) as unknown as number);
    clearTimeoutIdMap(map);
    expect(map.size).toBe(0);
    vi.useRealTimers();
  });

  it('resetInactivityTimeout replaces existing timer', () => {
    vi.useFakeTimers();
    const onInactive = vi.fn();
    const first = resetInactivityTimeout(null, 50, onInactive);
    resetInactivityTimeout(first, 50, onInactive);
    vi.advanceTimersByTime(50);
    expect(onInactive).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('wirePrayerResumeListeners resumes on app-became-visible and not on focus', () => {
    const onLeaveBackground = vi.fn();
    const onEnterBackground = vi.fn();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    const subs = wirePrayerResumeListeners({
      onEnterBackground,
      onLeaveBackground,
      inactivityThresholdMs: 1000,
      getInactivityTimeout: () => null,
      setInactivityTimeout: vi.fn(),
      clearBackgroundRecoveryTimeouts: vi.fn(),
    });

    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onLeaveBackground).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent('app-became-visible'));
    expect(onLeaveBackground).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onEnterBackground).toHaveBeenCalledTimes(1);
    expect(onLeaveBackground).toHaveBeenCalledTimes(1);

    unsubscribePrayerResumeListeners(subs);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('unsubscribePrayerResumeListeners unsubscribes all subscriptions', () => {
    const sub = { unsubscribe: vi.fn() };
    unsubscribePrayerResumeListeners([sub as never]);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
