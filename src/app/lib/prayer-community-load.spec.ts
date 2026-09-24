import { describe, expect, it } from 'vitest';
import {
  formatApprovedCommunityPrayersFromDb,
  formatApprovedCommunityPrayersFromUpdatesMap,
  formatPrayersByMonthFromDb,
  formatPrayersByMonthFromSeparateUpdates,
  groupPrayerUpdatesByPrayerId,
  prayersByMonthIsoRange,
  prayersByMonthOrFilter,
  sortPrayersByLatestActivity,
} from './prayer-community-load';
import type { PrayerRequest } from './prayer-types';

const basePrayer = (overrides: Partial<PrayerRequest> = {}): PrayerRequest => ({
  id: 'p1',
  title: 'Title',
  description: 'Desc',
  status: 'current',
  requester: 'User',
  prayer_for: 'Someone',
  type: 'prayer',
  date_requested: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  prayed_for_count: 0,
  content_kind: 'standard',
  verse_reference: null,
  verse_translation: null,
  admin_message: null,
  updates: [],
  ...overrides,
});

describe('sortPrayersByLatestActivity', () => {
  it('orders by latest update when present', () => {
    const older = basePrayer({
      id: 'older',
      created_at: '2026-01-01T00:00:00.000Z',
      updates: [
        {
          id: 'u1',
          prayer_id: 'older',
          content: 'x',
          author: 'a',
          created_at: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    const newer = basePrayer({
      id: 'newer',
      created_at: '2026-01-01T00:00:00.000Z',
      updates: [
        {
          id: 'u2',
          prayer_id: 'newer',
          content: 'y',
          author: 'a',
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
    });
    const sorted = sortPrayersByLatestActivity([older, newer]);
    expect(sorted.map((p) => p.id)).toEqual(['newer', 'older']);
  });
});

describe('prayersByMonthIsoRange', () => {
  it('returns UTC month boundaries', () => {
    const { startDate, endDate } = prayersByMonthIsoRange(2026, 3);
    expect(startDate).toBe(new Date(2026, 2, 1).toISOString());
    expect(endDate).toBe(new Date(2026, 3, 1).toISOString());
  });
});

describe('prayersByMonthOrFilter', () => {
  it('builds a PostgREST or filter for created and updated ranges', () => {
    expect(prayersByMonthOrFilter('2026-03-01', '2026-04-01')).toBe(
      '(updated_at.gte.2026-03-01,updated_at.lt.2026-04-01),(created_at.gte.2026-03-01,created_at.lt.2026-04-01)'
    );
  });
});

describe('groupPrayerUpdatesByPrayerId', () => {
  it('groups updates and tolerates empty input', () => {
    expect(groupPrayerUpdatesByPrayerId(null).size).toBe(0);
    const map = groupPrayerUpdatesByPrayerId([
      { prayer_id: 'a', id: '1' },
      { prayer_id: 'a', id: '2' },
      { prayer_id: 'b', id: '3' },
    ] as Array<{ prayer_id: string; id: string }>);
    expect(map.get('a')).toHaveLength(2);
    expect(map.get('b')).toHaveLength(1);
  });
});

describe('formatPrayersByMonthFromDb', () => {
  it('uses prayer_updates when present', () => {
    const prayers = formatPrayersByMonthFromDb([
      {
        ...basePrayer({ id: 'm1' }),
        prayer_updates: [
          {
            id: 'u1',
            prayer_id: 'm1',
            content: 'c',
            author: 'a',
            created_at: '2026-02-01T00:00:00.000Z',
          },
        ],
      } as Record<string, unknown>,
    ]);
    expect(prayers[0]?.updates).toHaveLength(1);
  });
});

describe('formatPrayersByMonthFromSeparateUpdates', () => {
  it('attaches updates from the map', () => {
    const map = new Map([
      [
        'p9',
        [{ id: 'u9', prayer_id: 'p9', content: 'z', author: 'a', created_at: '2026-01-02T00:00:00.000Z' }],
      ],
    ]);
    const prayers = formatPrayersByMonthFromSeparateUpdates(
      [{ id: 'p9', created_at: '2026-01-01T00:00:00.000Z' }],
      map
    );
    expect(prayers[0]?.updates).toHaveLength(1);
  });
});

describe('formatApprovedCommunityPrayersFromUpdatesMap', () => {
  it('maps verse memorization fields from prayer rows', () => {
    const prayers = formatApprovedCommunityPrayersFromUpdatesMap(
      [
        {
          id: 'p1',
          title: 'Mark 1:7',
          description: '[7] And he preached, saying, “After me comes he…” Mark 1:7',
          status: 'current',
          requester: 'Cross Pointe Church',
          prayer_for: 'Verse Memorization',
          type: 'prayer',
          date_requested: '2026-09-05T00:00:00.000Z',
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
          content_kind: 'verse_memorization',
          verse_reference: 'Mark 1:7',
          verse_translation: 'esv',
          admin_message: 'Memorize this week.',
        },
      ],
      new Map()
    );

    expect(prayers[0]?.content_kind).toBe('verse_memorization');
    expect(prayers[0]?.verse_reference).toBe('Mark 1:7');
    expect(prayers[0]?.verse_translation).toBe('esv');
    expect(prayers[0]?.admin_message).toBe('Memorize this week.');
  });
});

describe('formatApprovedCommunityPrayersFromDb', () => {
  it('maps verse memorization fields from joined prayer rows', () => {
    const prayers = formatApprovedCommunityPrayersFromDb([
      {
        id: 'p1',
        title: 'Mark 1:7',
        description: '[7] And he preached…',
        status: 'current',
        requester: 'Cross Pointe Church',
        prayer_for: 'Verse Memorization',
        type: 'prayer',
        date_requested: '2026-09-05T00:00:00.000Z',
        created_at: '2026-09-05T00:00:00.000Z',
        updated_at: '2026-09-05T00:00:00.000Z',
        content_kind: 'verse_memorization',
        verse_reference: 'Mark 1:7',
        verse_translation: 'esv',
        admin_message: null,
        prayer_updates: [],
      },
    ]);

    expect(prayers[0]?.content_kind).toBe('verse_memorization');
    expect(prayers[0]?.verse_reference).toBe('Mark 1:7');
  });

  it('keeps only approved updates and sorts them newest first', () => {
    const prayers = formatApprovedCommunityPrayersFromDb([
      {
        id: 'p2',
        title: 'T',
        description: null,
        status: 'current',
        requester: 'r',
        prayer_for: 'f',
        type: 'prayer',
        date_requested: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        prayer_updates: [
          {
            id: 'old',
            prayer_id: 'p2',
            content: 'old',
            author: 'a',
            approval_status: 'approved',
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'new',
            prayer_id: 'p2',
            content: 'new',
            author: 'a',
            approval_status: 'approved',
            created_at: '2026-02-01T00:00:00.000Z',
          },
          {
            id: 'pending',
            prayer_id: 'p2',
            content: 'skip',
            author: 'a',
            approval_status: 'pending',
            created_at: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    ]);

    expect(prayers[0]?.updates?.map((u) => u.id)).toEqual(['new', 'old']);
    expect(prayers[0]?.description).toBe('No description provided');
  });
});
