import {
  applyCachedPersonalPrayersSnapshot,
  applyPersonalPrayerLoadCacheFallbackPlan,
  planPersonalPrayerLoadCacheFallback,
  publishPersonalPrayersFromDb,
  shouldSkipCommunityPrayersDbOnSilentRefresh,
  type PersonalPrayersCacheSnapshotActions,
  type PrayerCatalogRefreshOptions,
} from "./prayer-catalog-load";
import type { PrayerRequest } from "./prayer-types";

export type PersonalPrayerLoadWireDeps = {
  getUserEmail: () => Promise<string | null>;
  readCache: () => PrayerRequest[] | null | undefined;
  invalidateCache: () => void;
  setLoading: (loading: boolean) => void;
  markFetchComplete: () => void;
  setPersonalPrayers: (prayers: PrayerRequest[]) => void;
  /** Clear in-memory catalog only (after cache invalidate on mismatched-user discard). */
  clearPersonalPrayersInMemory: () => void;
  cacheSnapshotActions: () => PersonalPrayersCacheSnapshotActions;
  fetchFromDb: (userEmail: string) => Promise<PrayerRequest[]>;
  dropAnsweredReminders: (prayers: PrayerRequest[]) => void;
};

export async function runPersonalPrayerCatalogLoad(
  deps: PersonalPrayerLoadWireDeps,
  silentRefresh = false,
  options?: PrayerCatalogRefreshOptions
): Promise<void> {
  try {
    deps.setLoading(true);

    const userEmail = await deps.getUserEmail();
    if (!userEmail) {
      console.warn(
        "[PrayerService] User email not available for personal prayers"
      );
      deps.markFetchComplete();
      return;
    }

    const cachedPersonalPrayers = deps.readCache();
    if (cachedPersonalPrayers && cachedPersonalPrayers.length > 0) {
      applyCachedPersonalPrayersSnapshot(
        cachedPersonalPrayers,
        deps.cacheSnapshotActions()
      );

      if (
        shouldSkipCommunityPrayersDbOnSilentRefresh(
          silentRefresh,
          cachedPersonalPrayers,
          options?.bypassWarmCache === true
        )
      ) {
        return;
      }
    }

    const personalPrayers = await deps.fetchFromDb(userEmail);

    publishPersonalPrayersFromDb(personalPrayers, {
      setPersonalPrayers: (prayers) => deps.setPersonalPrayers(prayers),
      dropAnsweredReminders: (prayers) => deps.dropAnsweredReminders(prayers),
    });
  } catch (err) {
    console.error("[PrayerService] Failed to load personal prayers:", err);

    const userEmail = await deps.getUserEmail();
    const cacheFallback = planPersonalPrayerLoadCacheFallback(
      deps.readCache(),
      userEmail
    );

    applyPersonalPrayerLoadCacheFallbackPlan(cacheFallback, {
      applyCachedSnapshot: (prayers) => {
        applyCachedPersonalPrayersSnapshot(
          prayers,
          deps.cacheSnapshotActions()
        );
      },
      invalidatePersonalCache: () => deps.invalidateCache(),
      clearPersonalPrayers: () => {
        console.warn(
          "[PrayerService] Cached personal prayers do not match current user - discarding cache"
        );
        deps.clearPersonalPrayersInMemory();
      },
    });
  } finally {
    deps.setLoading(false);
    deps.markFetchComplete();
  }
}
