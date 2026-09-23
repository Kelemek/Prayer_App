import { describe, expect, it, vi } from 'vitest';
import {
  readNonEmptyPrayerCache,
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

  it('wirePrayerResumeListeners schedules resume on focus when visible', () => {
    const schedule = vi.fn();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    wirePrayerResumeListeners({
      scheduleResumeRefresh: schedule,
      onEnterBackground: vi.fn(),
      onLeaveBackground: vi.fn(),
    });

    window.dispatchEvent(new Event('focus'));
    expect(schedule).toHaveBeenCalled();
  });

  it('unsubscribePrayerResumeListeners unsubscribes all subscriptions', () => {
    const sub = { unsubscribe: vi.fn() };
    unsubscribePrayerResumeListeners([sub as never]);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
