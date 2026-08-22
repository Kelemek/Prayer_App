import type { PrayerRequest } from './prayer-types';

export function parsePrayedForRpcCount(newCount: unknown): number | null {
  const count = typeof newCount === 'number' && newCount > 0 ? newCount : null;
  return count;
}

export function updatePrayerRequestPrayedForCount(
  prayers: PrayerRequest[],
  prayerId: string,
  count: number
): PrayerRequest[] {
  return prayers.map((p) =>
    p.id === prayerId ? { ...p, prayed_for_count: count } : p
  );
}

export function patchCommunityPrayerListsPrayedForCount(
  allPrayers: PrayerRequest[],
  filteredPrayers: PrayerRequest[],
  prayerId: string,
  count: number
): { all: PrayerRequest[]; filtered: PrayerRequest[] } {
  return {
    all: updatePrayerRequestPrayedForCount(allPrayers, prayerId, count),
    filtered: updatePrayerRequestPrayedForCount(filteredPrayers, prayerId, count),
  };
}

export function patchPersonalPrayersPrayedForCount(
  prayers: PrayerRequest[],
  prayerId: string,
  count: number
): PrayerRequest[] {
  return updatePrayerRequestPrayedForCount(prayers, prayerId, count);
}

export function seedPrayedForServerCounts(
  map: Map<string, number>,
  prayers: PrayerRequest[]
): void {
  for (const prayer of prayers) {
    map.set(prayer.id, prayer.prayed_for_count ?? 0);
  }
}

export function withPrayedForDisplayCounts(
  prayers: PrayerRequest[],
  displayCount: (prayerId: string) => number
): PrayerRequest[] {
  return prayers.map((prayer) => ({
    ...prayer,
    prayed_for_count: displayCount(prayer.id),
  }));
}

export function toPrayedForServerOnly(
  prayers: PrayerRequest[],
  serverMap: Map<string, number>
): PrayerRequest[] {
  return prayers.map((prayer) => ({
    ...prayer,
    prayed_for_count: serverMap.get(prayer.id) ?? prayer.prayed_for_count ?? 0,
  }));
}

export function prayedForServerBaseline(
  prayerId: string,
  serverMap: Map<string, number>,
  displayedCount: number,
  pendingCount: number
): number {
  const existing = serverMap.get(prayerId);
  if (existing !== undefined) {
    return existing;
  }
  const server = displayedCount - pendingCount;
  serverMap.set(prayerId, server);
  return server;
}
