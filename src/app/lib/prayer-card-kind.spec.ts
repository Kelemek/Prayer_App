import { describe, it, expect } from 'vitest';
import {
  getPrayerCardMutationKind,
  isMemberPrayerId,
  memberPrayerPersonId,
} from './prayer-card-kind';

describe('isMemberPrayerId', () => {
  it('detects planning center virtual card ids', () => {
    expect(isMemberPrayerId('pc-member-42')).toBe(true);
    expect(isMemberPrayerId('prayer-1')).toBe(false);
  });

  it('extracts person id', () => {
    expect(memberPrayerPersonId('pc-member-42')).toBe('42');
    expect(memberPrayerPersonId('prayer-1')).toBeNull();
  });
});

describe('getPrayerCardMutationKind', () => {
  it('treats community prayers with requester email as community', () => {
    expect(
      getPrayerCardMutationKind({
        id: 'p1',
        email: 'requester@example.com',
      })
    ).toBe('community');
  });

  it('treats prayers with user_email as personal when context omitted', () => {
    expect(
      getPrayerCardMutationKind({
        id: 'pp1',
        user_email: 'me@example.com',
      })
    ).toBe('personal');
  });

  it('forces community when Church card sets isPersonalCard false', () => {
    expect(
      getPrayerCardMutationKind(
        { id: 'p1', user_email: 'me@example.com' },
        { isPersonalCard: false }
      )
    ).toBe('community');
  });

  it('forces community for shared personal prayers on the Church feed', () => {
    expect(
      getPrayerCardMutationKind({
        id: 'p1',
        user_email: 'me@example.com',
        is_shared_personal_prayer: true,
      })
    ).toBe('community');
  });
});
