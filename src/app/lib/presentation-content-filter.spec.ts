import { describe, expect, it } from 'vitest';
import {
  filterCommunityPrayersByStatus,
  filterPersonalPrayersByCategories,
  filterPersonalPrayersByStatus,
  filterPresentationCommunityPrayers,
  filterPresentationPersonalPrayers,
  filterPromptsByCategories,
  sortPrayersByLatestActivity,
} from './presentation-content-filter';
import type { PrayerRequest } from '../services/prayer.service';

function prayer(overrides: Partial<PrayerRequest> = {}): PrayerRequest {
  return {
    id: 'p1',
    title: 'T',
    description: '',
    status: 'current',
    prayer_for: 'X',
    requester: 'Y',
    email: 'e@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as PrayerRequest;
}

describe('presentation-content-filter', () => {
  it('filterCommunityPrayersByStatus respects toggles', () => {
    const list = [
      prayer({ id: 'c', status: 'current' }),
      prayer({ id: 'a', status: 'answered' }),
    ];
    expect(
      filterCommunityPrayersByStatus(list, {
        current: true,
        answered: false,
        archived: false,
      }).map((p) => p.id)
    ).toEqual(['c']);
    expect(filterCommunityPrayersByStatus(list, { current: false, answered: false, archived: false })).toEqual(
      list
    );
  });

  it('filterPersonalPrayersByStatus splits answered category', () => {
    const list = [
      prayer({ id: '1', category: 'Health' }),
      prayer({ id: '2', category: 'Answered' }),
    ];
    expect(
      filterPersonalPrayersByStatus(list, {
        current: true,
        answered: false,
        archived: false,
      }).map((p) => p.id)
    ).toEqual(['1']);
    expect(
      filterPersonalPrayersByStatus(list, {
        current: false,
        answered: true,
        archived: false,
      }).map((p) => p.id)
    ).toEqual(['2']);
  });

  it('sortPrayersByLatestActivity orders by newest update', () => {
    const sorted = sortPrayersByLatestActivity([
      prayer({
        id: 'old',
        created_at: '2020-01-01T00:00:00Z',
        updates: [],
      }),
      prayer({
        id: 'new',
        created_at: '2020-01-01T00:00:00Z',
        updates: [{ id: 'u1', content: 'x', author: 'a', created_at: '2024-06-01T00:00:00Z' }],
      }),
    ]);
    expect(sorted[0]?.id).toBe('new');
  });

  it('filterPresentationCommunityPrayers applies status and time', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = filterPresentationCommunityPrayers(
      [prayer({ created_at: '2024-06-10T00:00:00Z' })],
      {
        timeFilter: 'week',
        statusFilters: { current: true, answered: false, archived: false },
        now,
      }
    );
    expect(result.length).toBe(1);
  });

  it('filterPresentationPersonalPrayers chains filters', () => {
    const result = filterPresentationPersonalPrayers(
      [prayer({ category: 'Family' })],
      {
        timeFilter: 'all',
        statusFilters: { current: true, answered: false, archived: false },
      }
    );
    expect(result.length).toBe(1);
  });

  it('filterPromptsByCategories and personal categories', () => {
    const prompts = [
      { id: '1', type: 'Morning', title: 'A', content: '', created_at: '', updated_at: '' },
      { id: '2', type: 'Evening', title: 'B', content: '', created_at: '', updated_at: '' },
    ] as never[];
    expect(filterPromptsByCategories(prompts, ['Morning']).map((p) => p.id)).toEqual(['1']);
    expect(
      filterPersonalPrayersByCategories(
        [prayer({ category: 'Family' }), prayer({ category: 'Work' })],
        ['Family']
      ).length
    ).toBe(1);
  });
});
