import { describe, expect, it } from 'vitest';
import {
  MEMBER_PRAYER_UPDATES_CACHE_KEY,
  buildMemberPrayerUpdateInsertRow,
  buildMemberPrayerUpdatePatch,
  groupMemberPrayerUpdatesByPersonId,
  mapMemberPrayerUpdateRow,
  memberPrayerCacheKeysToInvalidate,
  memberUpdatesCacheForPerson,
  planningCenterListDataCacheKey,
  trimMemberPersonId,
  writeMemberUpdatesCacheForPerson,
} from './prayer-member-updates';

describe('prayer-member-updates', () => {
  const row = {
    id: 'u1',
    person_id: 'p1',
    content: 'c',
    created_at: 't1',
    updated_at: 't2',
    is_answered: false,
  };

  it('maps and groups rows by person', () => {
    expect(mapMemberPrayerUpdateRow(row).id).toBe('u1');
    const grouped = groupMemberPrayerUpdatesByPersonId([row, { ...row, id: 'u2' }]);
    expect(grouped.p1).toHaveLength(2);
  });

  it('builds patch and insert payloads', () => {
    expect(buildMemberPrayerUpdatePatch({ content: 'x', is_answered: true })).toEqual({
      content: 'x',
      is_answered: true,
    });
    expect(buildMemberPrayerUpdateInsertRow('p1', 'c', true)).toEqual({
      person_id: 'p1',
      content: 'c',
      is_answered: true,
    });
  });

  it('cache helpers', () => {
    expect(trimMemberPersonId('  ')).toBeNull();
    expect(planningCenterListDataCacheKey('L')).toContain('L');
    expect(memberPrayerCacheKeysToInvalidate('L')).toEqual([
      MEMBER_PRAYER_UPDATES_CACHE_KEY,
      planningCenterListDataCacheKey('L'),
    ]);
    const cache = writeMemberUpdatesCacheForPerson(undefined, 'p1', [
      mapMemberPrayerUpdateRow(row),
    ]);
    expect(memberUpdatesCacheForPerson(cache, 'p1')).toHaveLength(1);
  });
});
