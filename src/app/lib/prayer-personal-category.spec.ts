import { describe, expect, it } from 'vitest';
import {
  applyPersonalCategoriesReorderLocally,
  applyPersonalCategoryDeleteLocally,
  findPersonalCategoryIdByName,
  isUncategorizedCategory,
  nextDisplayOrderAfterMax,
  personalPrayerOrderRpcArgs,
  validatePersonalCategoryRename,
} from './prayer-personal-category';

describe('prayer-personal-category', () => {
  it('validates personal category rename', () => {
    const sanitize = (c: string | null | undefined) => (c?.trim() ? c.trim() : null);
    expect(
      validatePersonalCategoryRename(' Old ', 'New', sanitize, ['Other'], [])
    ).toMatchObject({ ok: true, oldName: 'Old', newName: 'New' });
    expect(
      validatePersonalCategoryRename('Old', 'Old', sanitize, [], [])
    ).toEqual({ ok: true, oldName: 'Old', newName: 'Old', unchanged: true });
    expect(
      validatePersonalCategoryRename('Old', 'Taken', sanitize, ['Taken'], []).ok
    ).toBe(false);
  });

  it('nextDisplayOrderAfterMax increments from max or starts at 0', () => {
    expect(nextDisplayOrderAfterMax(5)).toBe(6);
    expect(nextDisplayOrderAfterMax(null)).toBe(0);
  });

  it('finds category id by name', () => {
    expect(
      findPersonalCategoryIdByName(
        [
          { id: 'c1', name: 'Family' },
          { id: 'c2', name: 'Work' },
        ],
        'Family'
      )
    ).toBe('c1');
  });

  it('reorders category entities by id list', () => {
    const reordered = applyPersonalCategoriesReorderLocally(
      [
        { id: 'a', name: 'A', display_order: 0, color: null },
        { id: 'b', name: 'B', display_order: 1, color: null },
      ],
      ['b', 'a']
    );
    expect(reordered.map((category) => category.id)).toEqual(['b', 'a']);
    expect(reordered.map((category) => category.display_order)).toEqual([0, 1]);
  });

  it('removes matching prayers when deleting a category locally', () => {
    const remaining = applyPersonalCategoryDeleteLocally(
      [
        { id: 'p1', category: 'Family' },
        { id: 'p2', category: 'Work' },
        { id: 'p3', category: ' Family ' },
      ] as never,
      'Family'
    );
    expect(remaining.map((prayer) => prayer.id)).toEqual(['p2']);
  });

  it('isUncategorizedCategory treats empty as uncategorized', () => {
    expect(isUncategorizedCategory(null)).toBe(true);
    expect(isUncategorizedCategory('  ')).toBe(true);
    expect(isUncategorizedCategory('Family')).toBe(false);
  });

  it('builds prayer order rpc args by category id', () => {
    expect(personalPrayerOrderRpcArgs('cat-1', ['p1', 'p2'])).toEqual({
      p_category_id: 'cat-1',
      p_ordered_prayer_ids: ['p1', 'p2'],
    });
    expect(personalPrayerOrderRpcArgs(null, ['p3'])).toEqual({
      p_category_id: null,
      p_ordered_prayer_ids: ['p3'],
    });
  });
});
