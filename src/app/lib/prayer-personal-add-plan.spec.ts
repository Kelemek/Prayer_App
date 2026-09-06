import { describe, expect, it, vi } from 'vitest';
import { planPersonalPrayerAdd } from './prayer-personal-add-plan';

describe('planPersonalPrayerAdd', () => {
  it('ensures a named category and uses max display order + 1', async () => {
    const ensureCategory = vi.fn().mockResolvedValue('cat-1');
    const plan = await planPersonalPrayerAdd(
      'Family',
      'me@test.com',
      (c) => c ?? null,
      {
        ensureCategory,
        queryMaxDisplayOrder: vi.fn().mockResolvedValue({
          data: { display_order: 4 },
          error: null,
        }),
      }
    );
    expect(ensureCategory).toHaveBeenCalledWith('Family');
    expect(plan).toEqual({
      ok: true,
      category: 'Family',
      categoryId: 'cat-1',
      displayOrder: 5,
    });
  });

  it('starts uncategorized prayers at display order 0', async () => {
    const plan = await planPersonalPrayerAdd(
      null,
      'me@test.com',
      () => null,
      {
        ensureCategory: vi.fn(),
        queryMaxDisplayOrder: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }
    );
    expect(plan).toEqual({
      ok: true,
      category: null,
      categoryId: null,
      displayOrder: 0,
    });
  });
});
