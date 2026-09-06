import { nextDisplayOrderAfterMax } from './prayer-personal-category';
import { maxDisplayOrderFromCategoryQuery } from './prayer-personal-mutations';

export type PersonalCategoryMaxOrderQuery = (
  categoryId: string | null
) => Promise<{
  data: { display_order?: number | null } | null;
  error: unknown;
}>;

export type PersonalCategoryDeps = {
  ensureCategory: (name: string) => Promise<string>;
  queryMaxDisplayOrder: PersonalCategoryMaxOrderQuery;
};

export type PersonalPrayerAddPlan =
  | { ok: false; userMessage: string }
  | {
      ok: true;
      category: string | null;
      categoryId: string | null;
      displayOrder: number;
    };

export async function planPersonalPrayerAdd(
  prayerCategory: string | null | undefined,
  _userEmail: string,
  sanitizeCategory: (category: string | null | undefined) => string | null,
  deps: PersonalCategoryDeps
): Promise<PersonalPrayerAddPlan> {
  const category = sanitizeCategory(prayerCategory);
  let categoryId: string | null = null;
  if (category) {
    try {
      categoryId = await deps.ensureCategory(category);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save category';
      return { ok: false, userMessage: message };
    }
  }

  const { data: maxData, error: maxError } = await deps.queryMaxDisplayOrder(
    categoryId
  );
  if (maxError) {
    return { ok: false, userMessage: 'Failed to determine prayer order' };
  }

  return {
    ok: true,
    category,
    categoryId,
    displayOrder: nextDisplayOrderAfterMax(
      maxDisplayOrderFromCategoryQuery(maxError, maxData, 0)
    ),
  };
}
