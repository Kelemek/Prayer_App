import { describe, it, expect } from 'vitest';
import { isMemberPrayerId, memberPrayerPersonId } from './prayer-card-kind';

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
