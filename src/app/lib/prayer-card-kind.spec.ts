import { describe, it, expect } from 'vitest';
import {
  isCommunityPrayerCard,
  isPersonalPrayerCard,
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
});
