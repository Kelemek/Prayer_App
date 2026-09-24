import { describe, it, expect, vi } from 'vitest';
import { PrayerCardTitleBodyComponent } from './prayer-card-title-body.component';

describe('PrayerCardTitleBodyComponent', () => {
  it('detects member prayers and formats verse text', () => {
    const component = new PrayerCardTitleBodyComponent();
    component.prayer = {
      id: 'pc-member-m1',
      prayer_for: 'Member',
      description: 'text',
      verse_reference: 'John 3:16',
      updates: [],
    } as never;
    component.variantLayout = { titleClasses: '', bodyClasses: '' } as never;
    component.displayRequester = 'Member';
    component.badgeService = {} as never;

    expect(component.isMemberPrayer()).toBe(true);
    expect(component.verseTextForDisplay()).toContain('John 3:16');

    const read = vi.fn();
    component.markPrayerRead.subscribe(read);
    component.onMarkPrayerRead();
    expect(read).toHaveBeenCalled();
  });
});
