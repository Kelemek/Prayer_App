import { sanitizePersonalPrayerCategory } from './prayer-personal-display';
import type { PersonalCategory } from '../types/personal-category';
import type { PrayerRequest } from './prayer-types';

export function isUncategorizedCategory(category: string | null | undefined): boolean {
  return !category || category.trim().length === 0;
}

export function personalCategoryDisplayName(category: string | null | undefined): string {
  return category || 'Uncategorized';
}

export function nextDisplayOrderAfterMax(
  maxDisplayOrder: number | null | undefined
): number {
  return (maxDisplayOrder ?? -1) + 1;
}

export function groupPersonalPrayersByCategoryId(
  prayers: PrayerRequest[]
): Map<string | null, PrayerRequest[]> {
  const prayersByCategory = new Map<string | null, PrayerRequest[]>();
  for (const prayer of prayers) {
    const categoryId = prayer.category_id ?? null;
    const group = prayersByCategory.get(categoryId);
    if (group) {
      group.push(prayer);
    } else {
      prayersByCategory.set(categoryId, [prayer]);
    }
  }
  return prayersByCategory;
}

export function findPersonalCategoryIdByName(
  categories: ReadonlyArray<Pick<PersonalCategory, 'id' | 'name'>>,
  name: string | null | undefined
): string | null {
  const needle = sanitizePersonalPrayerCategory(name);
  if (!needle) {
    return null;
  }
  const match = categories.find(
    (category) =>
      sanitizePersonalPrayerCategory(category.name)?.toLowerCase() ===
      needle.toLowerCase()
  );
  return match?.id ?? null;
}

export function personalCategoryReorderRpcArgs(orderedIds: string[]): {
  p_ordered_ids: string[];
} {
  return { p_ordered_ids: orderedIds };
}

export function personalPrayerOrderRpcArgs(
  categoryId: string | null,
  orderedPrayerIds: string[]
): {
  p_category_id: string | null;
  p_ordered_prayer_ids: string[];
} {
  return {
    p_category_id: categoryId,
    p_ordered_prayer_ids: orderedPrayerIds,
  };
}

export function applyPersonalCategoriesReorderLocally(
  categories: PersonalCategory[],
  orderedIds: string[]
): PersonalCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const reordered: PersonalCategory[] = [];
  orderedIds.forEach((id, index) => {
    const category = byId.get(id);
    if (!category) {
      return;
    }
    reordered.push({ ...category, display_order: index });
    byId.delete(id);
  });
  for (const leftover of byId.values()) {
    reordered.push(leftover);
  }
  return reordered.sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  );
}

export type PersonalCategoryRenameValidation =
  | { ok: true; oldName: string; newName: string; unchanged?: boolean }
  | { ok: false; errorMessage: string };

export function validatePersonalCategoryRename(
  oldCategory: string | null | undefined,
  newCategory: string | null | undefined,
  sanitize: (category: string | null | undefined) => string | null,
  existingNames: string[],
  reservedNames: string[] = []
): PersonalCategoryRenameValidation {
  const oldName = sanitize(oldCategory);
  if (!oldName) {
    return { ok: false, errorMessage: 'Category not found' };
  }

  const newName = sanitize(newCategory);
  if (!newName) {
    return { ok: false, errorMessage: 'Enter a category name' };
  }

  if (oldName === newName) {
    return { ok: true, oldName, newName, unchanged: true };
  }

  if (
    isReservedOrExistingCategoryName(newName, existingNames, reservedNames, oldName)
  ) {
    return { ok: false, errorMessage: `Category "${newName}" already exists` };
  }

  return { ok: true, oldName, newName };
}

export function isReservedOrExistingCategoryName(
  newName: string,
  existingNames: string[],
  reservedNames: string[] = [],
  ignoreName?: string
): boolean {
  const ignore = ignoreName?.toLowerCase();
  const duplicateNames = new Set(
    [...existingNames, ...reservedNames]
      .filter((name) => name.toLowerCase() !== ignore)
      .map((name) => name.toLowerCase())
  );
  return duplicateNames.has(newName.toLowerCase());
}

export function applyPersonalCategoryRenameLocally(
  allPrayers: PrayerRequest[],
  oldName: string,
  newName: string
): PrayerRequest[] {
  return allPrayers.map((p) =>
    sanitizePersonalPrayerCategory(p.category) === oldName
      ? { ...p, category: newName }
      : p
  );
}

export function applyPersonalCategoriesRenameLocally(
  categories: PersonalCategory[],
  oldName: string,
  newName: string
): PersonalCategory[] {
  return categories.map((category) =>
    sanitizePersonalPrayerCategory(category.name) === oldName
      ? { ...category, name: newName }
      : category
  );
}

export function applyPersonalCategoryDeleteLocally(
  allPrayers: PrayerRequest[],
  categoryName: string
): PrayerRequest[] {
  return allPrayers.filter(
    (p) => sanitizePersonalPrayerCategory(p.category) !== categoryName
  );
}

export function applyPersonalCategoriesDeleteLocally(
  categories: PersonalCategory[],
  categoryName: string
): PersonalCategory[] {
  return categories.filter(
    (category) => sanitizePersonalPrayerCategory(category.name) !== categoryName
  );
}
