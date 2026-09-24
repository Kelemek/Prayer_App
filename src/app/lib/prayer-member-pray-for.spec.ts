import { describe, expect, it } from 'vitest';
import {
  memberPrayedForCountsFromRows,
  readMemberPrayedForCountsCache,
  writeMemberPrayedForCountToCache,
} from './prayer-member-pray-for';

describe('prayer-member-pray-for', () => {
  it('builds counts map from rows', () => {
    expect(
      memberPrayedForCountsFromRows([
        { person_id: 'a', prayed_for_count: 2 },
        { person_id: 'b', prayed_for_count: null },
      ])
    ).toEqual({ a: 2, b: 0 });
  });

  it('reads and writes cache', () => {
    expect(readMemberPrayedForCountsCache(null)).toEqual({});
    expect(writeMemberPrayedForCountToCache({ a: 1 }, 'b', 3)).toEqual({
      a: 1,
      b: 3,
    });
  });
});
