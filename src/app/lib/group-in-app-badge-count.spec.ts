import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { groupPrayersCacheKey } from './prayer-tenant';
import {
  countDisplayedGroupBadgesAcrossCaches,
  emptyGroupBadgeReadState,
  groupBadgeReadCacheKey,
  parseGroupBadgeReadState,
  resolveGroupBadgeTargetGroupIds,
  writeMemberPrayerGroupIdsToStorage,
  receiptsToGroupReadState,
} from './group-in-app-badge-count';

describe('group-in-app-badge-count', () => {
  const groupId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const memberScope = { memberGroupIds: [groupId] };

  beforeEach(() => {
    localStorage.clear();
    writeMemberPrayerGroupIdsToStorage(localStorage, 'user@example.com', [groupId]);
    localStorage.setItem(
      groupPrayersCacheKey(groupId),
      JSON.stringify({
        data: [
          {
            id: 'gp-current',
            status: 'current',
            updates: [{ id: 'gu-1' }],
          },
          { id: 'gp-answered', status: 'answered' },
          { id: 'gp-archived', status: 'archived' },
        ],
      })
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('counts unread current and answered prayers and updates', () => {
    expect(
      countDisplayedGroupBadgesAcrossCaches(
        localStorage,
        [groupId],
        emptyGroupBadgeReadState(),
        memberScope
      )
    ).toBe(3);

    expect(
      countDisplayedGroupBadgesAcrossCaches(
        localStorage,
        [groupId],
        emptyGroupBadgeReadState(),
        { ...memberScope, status: 'current' }
      )
    ).toBe(2);

    expect(
      countDisplayedGroupBadgesAcrossCaches(
        localStorage,
        [groupId],
        emptyGroupBadgeReadState(),
        { ...memberScope, groupId }
      )
    ).toBe(3);
  });

  it('excludes read prayers and updates from the count', () => {
    const readState = receiptsToGroupReadState([
      {
        item_kind: 'group_prayer',
        item_id: 'gp-current',
        group_id: groupId,
      },
      {
        item_kind: 'group_prayer_update',
        item_id: 'gu-1',
        group_id: groupId,
      },
    ]);

    expect(
      countDisplayedGroupBadgesAcrossCaches(localStorage, [groupId], readState, memberScope)
    ).toBe(1);
  });

  it('ignores orphaned groupPrayers caches when memberGroupIds is set', () => {
    const leftGroupId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    localStorage.setItem(
      groupPrayersCacheKey(leftGroupId),
      JSON.stringify({
        data: [{ id: 'orphan', status: 'current', updates: [] }],
      })
    );
    writeMemberPrayerGroupIdsToStorage(localStorage, 'user@example.com', [
      groupId,
    ]);

    expect(
      countDisplayedGroupBadgesAcrossCaches(
        localStorage,
        [],
        emptyGroupBadgeReadState(),
        { memberGroupIds: [groupId] }
      )
    ).toBe(3);
  });

  it('does not count group prayers or updates authored by the viewer', () => {
    localStorage.setItem(
      groupPrayersCacheKey(groupId),
      JSON.stringify({
        data: [
          {
            id: 'gp-mine',
            status: 'current',
            email: 'viewer@example.com',
            updates: [{ id: 'gu-mine', author_email: 'viewer@example.com' }],
          },
          {
            id: 'gp-theirs',
            status: 'current',
            email: 'other@example.com',
            updates: [{ id: 'gu-theirs', author_email: 'other@example.com' }],
          },
        ],
      })
    );

    expect(
      countDisplayedGroupBadgesAcrossCaches(
        localStorage,
        [groupId],
        emptyGroupBadgeReadState(),
        { ...memberScope, viewerEmail: 'viewer@example.com' }
      )
    ).toBe(2);
  });

  it('returns no targets when membership is not hydrated', () => {
    localStorage.removeItem(`memberPrayerGroupIds:user@example.com`);
    expect(
      resolveGroupBadgeTargetGroupIds(localStorage, { memberGroupIds: null })
    ).toEqual([]);
  });

  it('parses email-scoped cache keys and legacy groupUpdates field', () => {
    expect(groupBadgeReadCacheKey(' User@Example.com ')).toBe(
      'badge_read_groups:user@example.com'
    );
    expect(
      parseGroupBadgeReadState({
        groupPrayers: ['a'],
        groupUpdates: ['b'],
      }).groupPrayerUpdates
    ).toEqual(['b']);
  });
});
