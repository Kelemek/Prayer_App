import {
  afterWarmCatalogCachePainted,
  applyCommunityLoadErrorPlan,
  applyCommunityPrayersCacheSnapshot,
  hasWarmCatalogCache,
  planCommunityLoadErrorFallback,
  publishCommunityPrayersFromDb,
  shouldShowCatalogSkeletonForLiveLoad,
  shouldSkipCatalogDbOnSilentRefresh,
  type PrayerCatalogRefreshOptions,
} from './prayer-catalog-load';
import { formatApprovedCommunityPrayersFromDb } from './prayer-community-load';
import type { PrayerRequest } from './prayer-types';

export type CommunityPrayerLoadWireDeps = {
  readCache: () => PrayerRequest[] | null | undefined;
  setFetchInFlight: (inFlight: boolean) => void;
  markDbFetchComplete: () => void;
  setAllPrayersInMemory: (prayers: PrayerRequest[]) => void;
  setCache: (prayers: PrayerRequest[]) => void;
  reapplyFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  refreshBadges: () => void;
  emitErrorToast: () => void;
  getLastErrorToastTime: () => number;
  loadErrorToastCooldownMs: number;
  isFetchInFlight: () => boolean;
  fetchApprovedFromDb: () => Promise<Record<string, unknown>[]>;
};

export async function runCommunityPrayerCatalogLoad(
  deps: CommunityPrayerLoadWireDeps,
  silentRefresh = false,
  options?: PrayerCatalogRefreshOptions
): Promise<void> {
  const cachedPrayers = deps.readCache();
  const skipDb = shouldSkipCatalogDbOnSilentRefresh(
    silentRefresh,
    cachedPrayers,
    options?.bypassWarmCache === true
  );

  try {
    if (!skipDb) {
      deps.setFetchInFlight(true);
    }

    if (hasWarmCatalogCache(cachedPrayers)) {
      applyCommunityPrayersCacheSnapshot(cachedPrayers, {
        setAllPrayers: (prayers) => deps.setAllPrayersInMemory(prayers),
        reapplyFilters: () => deps.reapplyFilters(),
      });
      afterWarmCatalogCachePainted(deps.setLoading);

      if (skipDb) {
        if (!deps.isFetchInFlight()) {
          deps.markDbFetchComplete();
        }
        return;
      }
    }

    if (shouldShowCatalogSkeletonForLiveLoad(silentRefresh, cachedPrayers)) {
      deps.setLoading(true);
    }
    deps.setError(null);

    const prayersData = await deps.fetchApprovedFromDb();

    publishCommunityPrayersFromDb(prayersData || [], formatApprovedCommunityPrayersFromDb, {
      setAllPrayers: (prayers) => deps.setAllPrayersInMemory(prayers),
      setCache: (prayers) => deps.setCache(prayers),
      reapplyFilters: () => deps.reapplyFilters(),
      refreshBadges: () => deps.refreshBadges(),
      markDbFetchComplete: () => deps.markDbFetchComplete(),
    });
  } catch (err) {
    console.error('[PrayerService] Failed to load prayers:', err);

    const fallbackPlan = planCommunityLoadErrorFallback(
      deps.readCache(),
      err,
      deps.getLastErrorToastTime(),
      deps.loadErrorToastCooldownMs
    );

    applyCommunityLoadErrorPlan(fallbackPlan, {
      setAllPrayers: (prayers) => deps.setAllPrayersInMemory(prayers),
      reapplyFilters: () => deps.reapplyFilters(),
      setError: (message) => deps.setError(message),
      emitErrorToast: () => deps.emitErrorToast(),
    });
    deps.markDbFetchComplete();
  } finally {
    if (!skipDb) {
      deps.setFetchInFlight(false);
    }
    deps.setLoading(false);
  }
}
