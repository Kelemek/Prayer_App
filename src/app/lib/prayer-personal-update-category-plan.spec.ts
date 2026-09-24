import { describe, expect, it, vi } from 'vitest';
import { resolvePersonalPrayerCategoryChangeDisplayOrder } from './prayer-personal-update-category-plan';

describe('resolvePersonalPrayerCategoryChangeDisplayOrder', () => {
  it('returns current order when category unchanged', async () => {
    const plan = await resolvePersonalPrayerCategoryChangeDisplayOrder(
      false,
      true,
      'Health',
      'cat1',
      5,
      { ensureCategory: vi.fn(), queryMaxDisplayOrder: vi.fn() }
    );
    expect(plan).toEqual({ ok: true, categoryId: 'cat1', displayOrder: 5 });
  });

  it('ensures category and recomputes display order', async () => {
    const deps = {
      ensureCategory: vi.fn().mockResolvedValue('new-cat'),
      queryMaxDisplayOrder: vi.fn().mockResolvedValue({
        data: { display_order: 10 },
        error: null,
      }),
    };
    const plan = await resolvePersonalPrayerCategoryChangeDisplayOrder(
      true,
      true,
      'Health',
      null,
      0,
      deps
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.categoryId).toBe('new-cat');
      expect(plan.displayOrder).toBeGreaterThan(10);
    }
  });

  it('returns user message when ensureCategory fails', async () => {
    const plan = await resolvePersonalPrayerCategoryChangeDisplayOrder(
      true,
      true,
      'Health',
      null,
      0,
      {
        ensureCategory: vi.fn().mockRejectedValue(new Error('nope')),
        queryMaxDisplayOrder: vi.fn(),
      }
    );
    expect(plan).toEqual({ ok: false, userMessage: 'nope' });
  });
});
