import { nextDisplayOrderAfterMax } from './prayer-personal-category';
import { maxDisplayOrderFromCategoryQuery } from './prayer-personal-mutations';

export type PersonalPrayerInsertDisplayOrderPlan =
  | { ok: true; displayOrder: number }
  | { ok: false; userMessage: string };

export function planPersonalPrayerInsertDisplayOrder(
  maxError: unknown,
  maxData: { display_order?: number | null } | null
): PersonalPrayerInsertDisplayOrderPlan {
  if (maxError) {
    return { ok: false, userMessage: 'Failed to determine prayer order' };
  }
  const maxOrder = maxDisplayOrderFromCategoryQuery(maxError, maxData, 0);
  return { ok: true, displayOrder: nextDisplayOrderAfterMax(maxOrder) };
}
