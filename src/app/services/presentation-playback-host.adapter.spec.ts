import { describe, it, expect, vi } from 'vitest';
import { PresentationPlaybackHostAdapter } from './presentation-playback-host.adapter';

describe('PresentationPlaybackHostAdapter', () => {
  it('proxies page state and cdr', () => {
    const page = {
      currentIndex: 1,
      loop: true,
      smartMode: false,
      displayDuration: 30,
      showSettings: false,
      showTimerNotification: true,
      items: [{ id: 'a' }, { id: 'b' }],
      currentItem: { id: 'a' },
      presentationScrollRef: { nativeElement: document.createElement('div') },
    };
    const cdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };
    const adapter = new PresentationPlaybackHostAdapter(page, cdr as never);

    expect(adapter.loop).toBe(true);
    expect(adapter.smartMode).toBe(false);
    expect(adapter.displayDuration).toBe(30);
    expect(adapter.showSettings).toBe(false);
    expect(adapter.showTimerNotification).toBe(true);
    expect(adapter.getSlideCount()).toBe(2);
    expect(adapter.getCurrentItem()?.id).toBe('a');
    expect(adapter.isPrayerItem({ id: 'p', prayer_for: 'x' } as never)).toBe(true);
    expect(adapter.isPrayerItem({ id: 'prompt' } as never)).toBe(false);
    expect(adapter.getScrollRoot()).toBe(page.presentationScrollRef.nativeElement);
    const withoutScroll = new PresentationPlaybackHostAdapter(
      { ...page, presentationScrollRef: undefined },
      cdr as never
    );
    expect(withoutScroll.getScrollRoot()).toBeNull();

    adapter.currentIndex = 2;
    expect(page.currentIndex).toBe(2);
    adapter.showSettings = true;
    expect(page.showSettings).toBe(true);
    adapter.showTimerNotification = false;
    expect(page.showTimerNotification).toBe(false);

    adapter.markForCheck();
    adapter.detectChanges();
    expect(cdr.markForCheck).toHaveBeenCalled();
    expect(cdr.detectChanges).toHaveBeenCalled();
  });
});
