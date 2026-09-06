import { describe, expect, it } from 'vitest';
import { planPersonalPrayerInsertDisplayOrder } from './prayer-personal-insert';

describe('prayer-personal-insert', () => {
  it('plans next display order after the current max', () => {
    const plan = planPersonalPrayerInsertDisplayOrder(null, {
      display_order: 4,
    });
    expect(plan).toEqual({ ok: true, displayOrder: 5 });
  });

  it('starts at 0 when the category is empty', () => {
    const plan = planPersonalPrayerInsertDisplayOrder(null, null);
    expect(plan).toEqual({ ok: true, displayOrder: 0 });
  });
});
