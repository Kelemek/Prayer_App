export type PrayerItemDeepLinkTab =
  | 'current'
  | 'answered'
  | 'archived'
  | 'total'
  | 'personal';

export type PersonalDeepLinkCategoryMode = 'current' | 'answered' | 'total';

export function resolvePersonalDeepLinkCategoryMode(
  prayerId: string,
  personalPrayers: ReadonlyArray<{ id: string; category?: string | null }>
): PersonalDeepLinkCategoryMode | null {
  const prayer = personalPrayers.find((p) => p.id === prayerId);
  if (!prayer) {
    return null;
  }
  if (prayer.category === 'Answered') {
    return 'answered';
  }
  return 'current';
}

export function resolvePrayerItemDeepLinkTab(
  prayerId: string,
  communityPrayers: ReadonlyArray<{ id: string; status: string }>,
  personalPrayers: ReadonlyArray<{ id: string }>
): PrayerItemDeepLinkTab | null {
  if (personalPrayers.some((p) => p.id === prayerId)) {
    return 'personal';
  }
  const community = communityPrayers.find((p) => p.id === prayerId);
  if (community) {
    if (community.status === 'answered') {
      return 'answered';
    }
    if (community.status === 'archived') {
      return 'archived';
    }
    return 'current';
  }
  return null;
}
