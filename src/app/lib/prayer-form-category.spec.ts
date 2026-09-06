import { describe, expect, it } from 'vitest';
import {
  filterPersonalPrayerCategories,
  isNodeInsidePersonalCategoryField,
} from './prayer-form-category';

describe('filterPersonalPrayerCategories', () => {
  const available = ['Health', 'Family', 'Work'];

  it('returns all categories when the search is empty', () => {
    expect(filterPersonalPrayerCategories(available, '')).toEqual(available);
    expect(filterPersonalPrayerCategories(available, '   ')).toEqual(available);
  });

  it('filters case-insensitively as the user types', () => {
    expect(filterPersonalPrayerCategories(available, 'hea')).toEqual(['Health']);
    expect(filterPersonalPrayerCategories(available, 'FA')).toEqual(['Family']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterPersonalPrayerCategories(available, 'xyz')).toEqual([]);
  });
});

describe('isNodeInsidePersonalCategoryField', () => {
  it('is true for nodes inside the category field wrapper', () => {
    const root = document.createElement('div');
    root.setAttribute('data-personal-category-field', '');
    const input = document.createElement('input');
    root.appendChild(input);
    expect(isNodeInsidePersonalCategoryField(input)).toBe(true);
  });

  it('is false for nodes outside the category field', () => {
    expect(
      isNodeInsidePersonalCategoryField(document.createElement('button'))
    ).toBe(false);
  });
});
