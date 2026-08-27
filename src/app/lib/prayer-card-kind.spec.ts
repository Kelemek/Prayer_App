import { describe, it, expect } from 'vitest';
import {
  isCommunityPrayerCard,
  isPersonalPrayerCard,
  isVerseMemorizationPrayer,
  getPrayerCardMutationKind,
} from './prayer-card-kind';

describe('prayer-card-kind', () => {
  it('isPersonalPrayerCard respects flag or user_email', () => {
    expect(isPersonalPrayerCard({ id: 'p1', user_email: 'a@b.com' })).toBe(true);
    expect(isPersonalPrayerCard({ id: 'p1' }, true)).toBe(true);
    expect(isPersonalPrayerCard({ id: 'p1' })).toBe(false);
  });

  it('isCommunityPrayerCard is the inverse of the personal flag', () => {
    expect(isCommunityPrayerCard({ id: 'p1' })).toBe(true);
    expect(isCommunityPrayerCard({ id: 'p1' }, true)).toBe(false);
  });

  it('getPrayerCardMutationKind dispatches personal and community', () => {
    expect(getPrayerCardMutationKind({ id: 'p1', user_email: 'a@b.com' })).toBe(
      'personal'
    );
    expect(getPrayerCardMutationKind({ id: 'p1' })).toBe('community');
  });

  it('isVerseMemorizationPrayer detects content_kind verse_memorization', () => {
    expect(
      isVerseMemorizationPrayer({ id: 'p1', content_kind: 'verse_memorization' })
    ).toBe(true);
    expect(isVerseMemorizationPrayer({ id: 'p1', content_kind: 'standard' })).toBe(
      false
    );
    expect(isVerseMemorizationPrayer({ id: 'p1' })).toBe(false);
  });
});
