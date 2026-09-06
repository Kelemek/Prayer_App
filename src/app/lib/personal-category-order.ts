import type { PersonalCategory } from "../types/personal-category";
import type { PrayerRequest } from "./prayer-types";

type CategoryOrderPrayer = Pick<PrayerRequest, "category">;

export function personalCategoryNamesFromEntities(
  categories: ReadonlyArray<Pick<PersonalCategory, "name" | "display_order">>
): string[] {
  return [...categories]
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    .map((category) => category.name);
}

export function namedPersonalCategoryNamesFromEntities(
  categories: ReadonlyArray<Pick<PersonalCategory, "name" | "display_order">>
): string[] {
  return personalCategoryNamesFromEntities(categories).filter(
    (category) => category !== "Answered"
  );
}

/** Unique category names from prayers (order is first-seen). */
export function personalCategoryNamesFromPrayers(
  prayers: ReadonlyArray<CategoryOrderPrayer>
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const prayer of prayers) {
    const category = prayer.category?.trim();
    if (!category || seen.has(category)) {
      continue;
    }
    seen.add(category);
    names.push(category);
  }
  return names;
}

/** Named personal category chips exclude the reserved Answered label. */
export function namedPersonalCategoryNamesFromPrayers(
  prayers: ReadonlyArray<CategoryOrderPrayer>
): string[] {
  return personalCategoryNamesFromPrayers(prayers).filter(
    (category) => category !== "Answered"
  );
}

/** Prefer table chip order; if that list is empty, use names already on prayers. */
export function namedPersonalCategoryChipNames(
  categories: ReadonlyArray<Pick<PersonalCategory, "name" | "display_order">>,
  prayers: ReadonlyArray<CategoryOrderPrayer> = []
): string[] {
  const fromEntities = namedPersonalCategoryNamesFromEntities(categories);
  if (fromEntities.length > 0) {
    return fromEntities;
  }
  return namedPersonalCategoryNamesFromPrayers(prayers);
}
