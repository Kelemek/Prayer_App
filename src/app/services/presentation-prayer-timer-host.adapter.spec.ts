import { describe, it, expect, vi } from 'vitest';
import { PresentationPrayerTimerHostAdapter } from './presentation-prayer-timer-host.adapter';

describe('PresentationPrayerTimerHostAdapter', () => {
  it('proxies timer notification state and closes settings', () => {
    const page = { showSettings: true, showTimerNotification: false };
    const cdr = { detectChanges: vi.fn() };
    const adapter = new PresentationPrayerTimerHostAdapter(page, cdr as never);

    adapter.showTimerNotification = true;
    expect(page.showTimerNotification).toBe(true);
    adapter.closeSettings();
    expect(page.showSettings).toBe(false);
    adapter.detectChanges();
    expect(cdr.detectChanges).toHaveBeenCalled();
  });
});
