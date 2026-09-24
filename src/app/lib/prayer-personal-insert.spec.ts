import { describe, expect, it } from 'vitest';
import { planPersonalPrayerInsertDisplayOrder } from './prayer-personal-insert';

describe('planPersonalPrayerInsertDisplayOrder', () => {
  it('returns error when max query fails', () => {
    expect(planPersonalPrayerInsertDisplayOrder(new Error('db'), null)).toEqual({
      ok: false,
      userMessage: 'Failed to determine prayer order',
    });
  });

  it('computes next display order after max', () => {
    const plan = planPersonalPrayerInsertDisplayOrder(null, { display_order: 5 });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.displayOrder).toBeGreaterThan(5);
    }
  });
});
