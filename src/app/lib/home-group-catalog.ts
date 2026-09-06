import type { PrayerRequest } from "../services/prayer.service";

/** Groups tab fixed chips + named group selection. */
export type GroupFilterMode = "current" | "answered" | "total" | "named";

export interface HomeGroupFilterState {
  mode: GroupFilterMode;
  selectedGroupId: string | null;
  searchTerm?: string;
}

function normalizeSearchTerm(searchTerm: string | undefined): string {
  return searchTerm?.trim().toLowerCase() ?? "";
}

function prayerMatchesSearch(
  prayer: PrayerRequest,
  searchLower: string
): boolean {
  if (!searchLower) {
    return true;
  }
  const prayerMatch =
    prayer.prayer_for.toLowerCase().includes(searchLower) ||
    prayer.description.toLowerCase().includes(searchLower) ||
    prayer.title.toLowerCase().includes(searchLower);
  const updateMatch =
    prayer.updates?.some(
      (update) =>
        update.content && update.content.toLowerCase().includes(searchLower)
    ) ?? false;
  return prayerMatch || updateMatch;
}

export function countGroupPrayersByStatus(prayers: PrayerRequest[]): {
  current: number;
  answered: number;
  total: number;
} {
  let current = 0;
  let answered = 0;
  for (const prayer of prayers) {
    if (prayer.status === "answered") {
      answered += 1;
    } else {
      current += 1;
    }
  }
  return { current, answered, total: prayers.length };
}

export function filterGroupPrayersForHome(
  prayers: PrayerRequest[],
  state: HomeGroupFilterState
): PrayerRequest[] {
  const searchLower = normalizeSearchTerm(state.searchTerm);
  let filtered = searchLower
    ? prayers.filter((prayer) => prayerMatchesSearch(prayer, searchLower))
    : [...prayers];

  switch (state.mode) {
    case "current":
      filtered = filtered.filter((p) => p.status !== "answered");
      break;
    case "answered":
      filtered = filtered.filter((p) => p.status === "answered");
      break;
    case "total":
      break;
    case "named":
      if (state.selectedGroupId) {
        filtered = filtered.filter((p) => p.group_id === state.selectedGroupId);
      }
      break;
    default: {
      const _exhaustive: never = state.mode;
      return _exhaustive;
    }
  }

  return filtered;
}
