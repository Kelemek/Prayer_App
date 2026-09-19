import { describe, expect, it } from 'vitest';
import {
  appIconBadgeCountAfterAppOpen,
  countDisplayedInAppPrayerBadges,
  countDisplayedInAppPrayerBadgesAfterOpeningSurface,
  countDisplayedInAppPrayerBadgesAcrossTenants,
  countInAppPrayerBadgesForItems,
  emptyInAppBadgeReadState,
  listMemberTenantIds,
  markInAppBadgeSurfaceRead,
  parseCachedBadgeItems,
  parseInAppBadgeReadState,
  readAllTenantInAppBadgeSnapshots,
  resolveAppIconBadgeCount,
  scopedInAppBadgeReadCacheKey,
  shouldClearAppIconBadgeOnAppOpen,
  type InAppBadgeCachedItem,
  type InAppBadgeReadState,
} from './in-app-prayer-badge-count';

const currentUnread: InAppBadgeCachedItem = {
  id: 'p-current',
  status: 'current',
  updates: [{ id: 'u-current' }],
};
const answeredUnread: InAppBadgeCachedItem = {
  id: 'p-answered',
  status: 'answered',
  updates: [],
};
const archivedUnread: InAppBadgeCachedItem = {
  id: 'p-archived',
  status: 'archived',
  updates: [{ id: 'u-archived' }],
};
const promptUnread: InAppBadgeCachedItem = {
  id: 'prompt-1',
  updates: [{ id: 'pu-1' }],
};

const unreadState: InAppBadgeReadState = emptyInAppBadgeReadState();

const snapshot = {
  prayers: [currentUnread, answeredUnread, archivedUnread],
  prompts: [promptUnread],
  readState: unreadState,
};

describe('in-app prayer badge count', () => {
  it('parses CacheService { data } wrappers and raw arrays', () => {
    expect(
      parseCachedBadgeItems({ data: [{ id: 'a', status: 'current' }] })
    ).toEqual([{ id: 'a', status: 'current' }]);
    expect(parseCachedBadgeItems([{ id: 'b' }])).toEqual([{ id: 'b' }]);
    expect(parseCachedBadgeItems('{"data":[{"id":"c"}]}')).toEqual([{ id: 'c' }]);
    expect(parseCachedBadgeItems('not-json')).toEqual([]);
    expect(parseCachedBadgeItems({ data: { bad: true } })).toEqual([]);
  });

  it('parses scoped read receipts including legacy updates key', () => {
    expect(
      parseInAppBadgeReadState({
        prayers: ['p1'],
        updates: ['u1'],
        prompts: ['pr1'],
      })
    ).toEqual({
      prayers: ['p1'],
      prayerUpdates: ['u1'],
      prompts: ['pr1'],
      promptUpdates: [],
    });
    expect(parseInAppBadgeReadState('{"prayerUpdates":["u2"]}')).toEqual({
      prayers: [],
      prayerUpdates: ['u2'],
      prompts: [],
      promptUpdates: [],
    });
    expect(parseInAppBadgeReadState('nope')).toEqual(emptyInAppBadgeReadState());
  });

  it('counts unread items and updates the same way as in-app pills', () => {
    expect(
      countInAppPrayerBadgesForItems(
        snapshot.prayers,
        [],
        [],
        'current'
      )
    ).toBe(2);
    expect(
      countInAppPrayerBadgesForItems(
        snapshot.prayers,
        ['p-current'],
        ['u-current'],
        'current'
      )
    ).toBe(0);
    expect(
      countInAppPrayerBadgesForItems(snapshot.prayers, [], [], 'answered')
    ).toBe(1);
  });

  it('displayed count is Current + Answered + Prompts, not archived', () => {
    // current prayer + current update + answered prayer + prompt + prompt update
    expect(countDisplayedInAppPrayerBadges(snapshot)).toBe(5);
  });

  it('sums displayed counts across every member tenant', () => {
    const tenantA = {
      tenantId: 'tenant-a',
      ...snapshot,
    };
    const tenantB = {
      tenantId: 'tenant-b',
      prayers: [{ id: 'b-current', status: 'current' }],
      prompts: [],
      readState: emptyInAppBadgeReadState(),
    };
    expect(countDisplayedInAppPrayerBadgesAcrossTenants([tenantA, tenantB])).toBe(
      6
    );
  });

  it('opening a badged surface decrements only that surface', () => {
    expect(
      countDisplayedInAppPrayerBadgesAfterOpeningSurface(snapshot, 'current')
    ).toBe(3);
    expect(
      countDisplayedInAppPrayerBadgesAfterOpeningSurface(snapshot, 'answered')
    ).toBe(4);
    expect(
      countDisplayedInAppPrayerBadgesAfterOpeningSurface(snapshot, 'prompts')
    ).toBe(3);
    expect(
      countDisplayedInAppPrayerBadgesAfterOpeningSurface(snapshot, 'church')
    ).toBe(2);
  });

  it('opening church marks current and answered read, leaving prompts', () => {
    const next = markInAppBadgeSurfaceRead(snapshot, 'church');
    expect(next.prayers).toEqual(expect.arrayContaining(['p-current', 'p-answered']));
    expect(next.prayerUpdates).toEqual(expect.arrayContaining(['u-current']));
    expect(next.prompts).toEqual([]);
  });

  it('does not clear the icon badge on app open', () => {
    expect(shouldClearAppIconBadgeOnAppOpen()).toBe(false);
    expect(appIconBadgeCountAfterAppOpen(7)).toBe(7);
    expect(appIconBadgeCountAfterAppOpen(0)).toBe(0);
  });

  it('resolves icon count to 0 when badges are disabled', () => {
    expect(
      resolveAppIconBadgeCount({
        badgesEnabled: false,
        allTenantDisplayedCount: 9,
      })
    ).toBe(0);
    expect(
      resolveAppIconBadgeCount({
        badgesEnabled: true,
        allTenantDisplayedCount: 9.8,
      })
    ).toBe(9);
    expect(
      resolveAppIconBadgeCount({
        badgesEnabled: true,
        allTenantDisplayedCount: -1,
      })
    ).toBe(0);
  });

  it('lists unique member tenant ids including the active tenant', () => {
    expect(
      listMemberTenantIds({
        memberTenants: [{ id: 'a' }, { id: 'b' }, { id: 'a' }],
        memberships: [{ tenant_id: 'c' }, { tenant_id: null }],
        activeTenantId: 'd',
      })
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reads per-tenant caches from storage and unions active read state', () => {
    const email = 'member@example.com';
    const storage = {
      getItem(key: string): string | null {
        if (key === 'tenant_aaa_prayers') {
          return JSON.stringify({
            data: [{ id: 'p1', status: 'current' }],
          });
        }
        if (key === 'prompts:aaa') {
          return JSON.stringify({ data: [{ id: 'pr1' }] });
        }
        if (key === scopedInAppBadgeReadCacheKey('aaa', email)) {
          return JSON.stringify({ prayers: ['p1'] });
        }
        if (key === 'tenant_bbb_prayers') {
          return JSON.stringify({
            data: [{ id: 'p2', status: 'answered' }],
          });
        }
        return null;
      },
    };
    const snapshots = readAllTenantInAppBadgeSnapshots(
      storage,
      ['aaa', 'bbb'],
      email,
      'aaa',
      { ...emptyInAppBadgeReadState(), prompts: ['pr1'] }
    );
    expect(countDisplayedInAppPrayerBadgesAcrossTenants(snapshots)).toBe(1);
  });
});
