import { describe, it, expect, vi } from 'vitest';
import { showPrayerCardUpdateAuthor } from '../../lib/prayer-card-display';
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
    expect(component.showRequesterName()).toBe(false);
    expect(component.verseTextForDisplay()).toContain('John 3:16');

    component.prayer = {
      id: 'gp1',
      group_id: 'g1',
      prayer_for: 'Mom',
      requester: 'Ada',
      updates: [],
    } as never;
    component.isPersonal = true;
    expect(component.showRequesterName()).toBe(true);

    component.prayer = {
      id: 'p1',
      prayer_for: 'Mom',
      updates: [],
    } as never;
    expect(component.showRequesterName()).toBe(false);
    expect(
      showPrayerCardUpdateAuthor({
        isCommunityPrayer: false,
        isGroupPrayer: true,
      })
    ).toBe(true);
    expect(
      showPrayerCardUpdateAuthor({
        isCommunityPrayer: false,
        isGroupPrayer: false,
      })
    ).toBe(false);

    const read = vi.fn();
    component.markPrayerRead.subscribe(read);
    component.onMarkPrayerRead();
    expect(read).toHaveBeenCalled();
  });
});
