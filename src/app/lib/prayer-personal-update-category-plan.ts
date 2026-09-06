import { displayOrderForPersonalCategoryChange } from './prayer-personal-update';
import type { PersonalCategoryDeps } from './prayer-personal-add-plan';

export type PersonalPrayerCategoryChangePlan =
  | { ok: false; userMessage: string }
  | { ok: true; categoryId: string | null; displayOrder: number };

export async function resolvePersonalPrayerCategoryChangeDisplayOrder(
  categoryChanged: boolean,
  updatesCategoryDefined: boolean,
  newCategory: string | null,
  currentCategoryId: string | null | undefined,
  currentDisplayOrder: number | undefined,
  deps: PersonalCategoryDeps
): Promise<PersonalPrayerCategoryChangePlan> {
  let displayOrder = currentDisplayOrder ?? 0;
  let categoryId = currentCategoryId ?? null;
  if (!categoryChanged || !updatesCategoryDefined) {
    return { ok: true, categoryId, displayOrder };
  }

  if (newCategory) {
    try {
      categoryId = await deps.ensureCategory(newCategory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save category';
      return { ok: false, userMessage: message };
    }
  } else {
    categoryId = null;
  }

  const { data: maxData, error: maxError } = await deps.queryMaxDisplayOrder(
    categoryId
  );
  displayOrder = displayOrderForPersonalCategoryChange(maxError, maxData);
  return { ok: true, categoryId, displayOrder };
}
