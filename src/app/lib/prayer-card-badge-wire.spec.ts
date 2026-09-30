import { describe, it, expect, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { PrayerCardBadgeWire } from './prayer-card-badge-wire';
import type { PrayerRequest } from '../services/prayer.service';
import type { BadgeService } from '../services/badge.service';

describe('PrayerCardBadgeWire', () => {
  it('uses group read helpers when prayer has group_id', () => {
    const groupPrayer = {
      id: 'gp-1',
      group_id: 'g-1',
      updates: [{ id: 'gu-1' }],
    } as PrayerRequest;

    const badgeService = {
      getUpdateBadgesChanged$: () => new BehaviorSubject<void>(undefined).asObservable(),
      getViewerEmailForBadges: () => null,
      isGroupPrayerUnread: vi.fn(() => true),
      isGroupUpdateUnread: vi.fn(() => true),
      isPrayerUnread: vi.fn(() => false),
      isUpdateUnread: vi.fn(() => false),
      markGroupUpdateAsRead: vi.fn(),
      markUpdateAsRead: vi.fn(),
    } as unknown as BadgeService;

    const wire = new PrayerCardBadgeWire(badgeService, () => groupPrayer);
    const destroy$ = new BehaviorSubject<void>(undefined);
    wire.init(destroy$);

    wire.markUpdateRead('gu-1', 'gp-1');
    expect(badgeService.markGroupUpdateAsRead).toHaveBeenCalledWith(
      'gu-1',
      'g-1'
    );
    expect(badgeService.markUpdateAsRead).not.toHaveBeenCalled();

    wire.destroy();
  });
});
