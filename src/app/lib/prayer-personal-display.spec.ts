import { describe, expect, it, vi } from 'vitest';
import {
  isPersonalPrayerDisplayOrderOnlyChange,
  normalizePersonalPrayerCache,
  personalPrayerRowToPrayerRequest,
  sanitizePersonalPrayerCategory,
  sortPersonalPrayersByDisplayOrder,
  sortPersonalPrayersForListing,
  withPersonalPrayerUserEmail,
} from './prayer-personal-display';
import type { PrayerRequest } from './prayer-types';

describe('prayer-personal-display', () => {
  it('sanitizePersonalPrayerCategory trims and rejects empty', () => {
    expect(sanitizePersonalPrayerCategory('  Health  ')).toBe('Health');
    expect(sanitizePersonalPrayerCategory('')).toBeNull();
    expect(sanitizePersonalPrayerCategory(null)).toBeNull();
  });

  it('sanitizePersonalPrayerCategory truncates long names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const long = 'x'.repeat(60);
    expect(sanitizePersonalPrayerCategory(long)?.length).toBe(50);
    warn.mockRestore();
  });

  it('isPersonalPrayerDisplayOrderOnlyChange detects order-only updates', () => {
    const oldRow = { title: 't', display_order: 1, updated_at: 'a' };
    const newRow = { title: 't', display_order: 2, updated_at: 'b' };
    expect(isPersonalPrayerDisplayOrderOnlyChange(oldRow, newRow)).toBe(true);
    expect(
      isPersonalPrayerDisplayOrderOnlyChange(
        { title: 't', display_order: 1 },
        { title: 'changed', display_order: 2 }
      )
    ).toBe(false);
    expect(isPersonalPrayerDisplayOrderOnlyChange(undefined, newRow)).toBe(false);
  });

  it('sortPersonalPrayersByDisplayOrder orders by display_order desc then created_at', () => {
    const prayers = [
      { id: '1', display_order: 1, created_at: '2024-02-01' },
      { id: '2', display_order: 2, created_at: '2024-01-01' },
    ] as PrayerRequest[];
    const sorted = sortPersonalPrayersByDisplayOrder(prayers);
    expect(sorted.map((p) => p.id)).toEqual(['2', '1']);
  });

  it('sortPersonalPrayersForListing puts uncategorized last and respects category order', () => {
    const prayers = [
      { id: 'a', category_id: 'c2', display_order: 1, created_at: '2024-01-01' },
      { id: 'b', category_id: null, display_order: 9, created_at: '2024-01-01' },
      { id: 'c', category_id: 'c1', display_order: 1, created_at: '2024-01-01' },
    ] as PrayerRequest[];
    const sorted = sortPersonalPrayersForListing(prayers, [
      { id: 'c1', display_order: 0 },
      { id: 'c2', display_order: 1 },
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('personalPrayerRowToPrayerRequest maps joined category and answered status', () => {
    const row = personalPrayerRowToPrayerRequest({
      id: 'p1',
      title: 'Title',
      description: 'Desc',
      category_id: 'cat1',
      personal_categories: { name: 'Answered' },
      prayer_for: 'Me',
      user_email: 'u@test.com',
      display_order: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      prayed_for_count: 3,
      personal_prayer_updates: [
        {
          id: 'u1',
          content: 'Update',
          author: 'Author',
          created_at: '2024-01-03',
        },
      ],
    });
    expect(row.status).toBe('answered');
    expect(row.category).toBe('Answered');
    expect(row.updates).toHaveLength(1);
    expect(row.prayed_for_count).toBe(3);
  });

  it('personalPrayerRowToPrayerRequest reads array-shaped category join', () => {
    const row = personalPrayerRowToPrayerRequest({
      id: 'p2',
      title: 'T',
      description: 'D',
      category_id: 'cat1',
      personal_categories: [{ name: 'Health' }],
      prayer_for: 'X',
      user_email: 'u@test.com',
      display_order: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
    expect(row.category).toBe('Health');
    expect(row.status).toBe('current');
  });

  it('withPersonalPrayerUserEmail and normalizePersonalPrayerCache fill email fields', () => {
    const prayer = { id: '1', user_email: 'u@test.com' } as PrayerRequest;
    expect(withPersonalPrayerUserEmail(prayer).email).toBe('u@test.com');
    expect(normalizePersonalPrayerCache([prayer])[0].email).toBe('u@test.com');
    expect(withPersonalPrayerUserEmail({ id: '2' } as PrayerRequest)).toEqual({
      id: '2',
    });
  });
});
