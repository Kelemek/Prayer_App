import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupPrayerBadgeService } from './group-prayer-badge.service';
import {
  groupBadgeReadCacheKey,
  writeMemberPrayerGroupIdsToStorage,
} from '../lib/group-in-app-badge-count';
import { groupPrayersCacheKey } from '../lib/prayer-tenant';
import { UserSessionService } from './user-session.service';

describe('GroupPrayerBadgeService', () => {
  let service: GroupPrayerBadgeService;

  beforeEach(() => {
    localStorage.clear();
    const userSession = {
      getUserEmail: vi.fn(() => 'user@example.com'),
    };
    service = new GroupPrayerBadgeService(
      { client: { rpc: vi.fn() } } as never,
      {
        get: (token: unknown) =>
          token === UserSessionService ? userSession : null,
      } as never
    );
    service.applyLocalCacheToMemory();
  });

  it('applyLocalCacheFromStorageEvent ignores keys for other users', () => {
    expect(
      service.applyLocalCacheFromStorageEvent(
        groupBadgeReadCacheKey('other@example.com')
      )
    ).toBe(false);
  });

  it('applyLocalCacheFromStorageEvent reloads read state for the signed-in user', () => {
    const key = groupBadgeReadCacheKey('user@example.com');
    localStorage.setItem(
      key,
      JSON.stringify({ groupPrayers: ['gp-read'], groupPrayerUpdates: [] })
    );
    expect(service.applyLocalCacheFromStorageEvent(key)).toBe(true);
    expect(service.isGroupPrayerUnread('gp-read')).toBe(false);
    expect(service.isGroupPrayerUnread('gp-unread')).toBe(true);
  });

  it('getDisplayedBadgeCount matches calculateBadgeCount viewer and membership rules', () => {
    const groupId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    localStorage.setItem(
      groupPrayersCacheKey(groupId),
      JSON.stringify({
        data: [
          {
            id: 'gp-mine',
            status: 'current',
            email: 'user@example.com',
          },
          {
            id: 'gp-theirs',
            status: 'current',
            email: 'other@example.com',
          },
        ],
      })
    );
    writeMemberPrayerGroupIdsToStorage(localStorage, 'user@example.com', [
      groupId,
    ]);

    expect(service.getDisplayedBadgeCount()).toBe(1);
  });
});
