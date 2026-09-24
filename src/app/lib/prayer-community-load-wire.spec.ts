import { describe, expect, it, vi } from 'vitest';
import { runCommunityPrayerCatalogLoad } from './prayer-community-load-wire';
import type { PrayerRequest } from './prayer-types';

describe('prayer-community-load-wire', () => {
  it('runCommunityPrayerCatalogLoad skips DB on silent refresh when cache exists', async () => {
    const fetchApprovedFromDb = vi.fn();
    const setAllPrayersInMemory = vi.fn();
    const cached = [{ id: '1' } as PrayerRequest];

    await runCommunityPrayerCatalogLoad(
      {
        readCache: () => cached,
        setFetchInFlight: vi.fn(),
        markDbFetchComplete: vi.fn(),
        setAllPrayersInMemory,
        setCache: vi.fn(),
        reapplyFilters: vi.fn(),
        setLoading: vi.fn(),
        setError: vi.fn(),
        refreshBadges: vi.fn(),
        emitErrorToast: vi.fn(),
        getLastErrorToastTime: () => 0,
        loadErrorToastCooldownMs: 60_000,
        isFetchInFlight: () => false,
        fetchApprovedFromDb,
      },
      true
    );

    expect(fetchApprovedFromDb).not.toHaveBeenCalled();
    expect(setAllPrayersInMemory).toHaveBeenCalledWith(cached);
  });

  it('runCommunityPrayerCatalogLoad hits the DB when a live refresh bypasses warm cache', async () => {
    const fetchApprovedFromDb = vi.fn().mockResolvedValue([]);
    const cached = [{ id: '1' } as PrayerRequest];

    await runCommunityPrayerCatalogLoad(
      {
        readCache: () => cached,
        setFetchInFlight: vi.fn(),
        markDbFetchComplete: vi.fn(),
        setAllPrayersInMemory: vi.fn(),
        setCache: vi.fn(),
        reapplyFilters: vi.fn(),
        setLoading: vi.fn(),
        setError: vi.fn(),
        refreshBadges: vi.fn(),
        emitErrorToast: vi.fn(),
        getLastErrorToastTime: () => 0,
        loadErrorToastCooldownMs: 60_000,
        isFetchInFlight: () => false,
        fetchApprovedFromDb,
      },
      true,
      { bypassWarmCache: true }
    );

    expect(fetchApprovedFromDb).toHaveBeenCalled();
  });

  it('runCommunityPrayerCatalogLoad fetches from DB when cache miss', async () => {
    const prayers = [{ id: '1' } as PrayerRequest];
    const fetchApprovedFromDb = vi.fn().mockResolvedValue(prayers);
    const setAllPrayersInMemory = vi.fn();
    const setCache = vi.fn();

    await runCommunityPrayerCatalogLoad({
      readCache: () => null,
      setFetchInFlight: vi.fn(),
      markDbFetchComplete: vi.fn(),
      setAllPrayersInMemory,
      setCache,
      reapplyFilters: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      refreshBadges: vi.fn(),
      emitErrorToast: vi.fn(),
      getLastErrorToastTime: () => 0,
      loadErrorToastCooldownMs: 60_000,
      isFetchInFlight: () => false,
      fetchApprovedFromDb,
    });

    expect(fetchApprovedFromDb).toHaveBeenCalled();
    expect(setAllPrayersInMemory).toHaveBeenCalled();
    expect(setCache).toHaveBeenCalled();
  });

  it('runCommunityPrayerCatalogLoad applies error fallback when fetch fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchApprovedFromDb = vi.fn().mockRejectedValue(new Error('network'));
    const setError = vi.fn();
    const emitErrorToast = vi.fn();
    const setAllPrayersInMemory = vi.fn();

    await runCommunityPrayerCatalogLoad({
      readCache: () => null,
      setFetchInFlight: vi.fn(),
      markDbFetchComplete: vi.fn(),
      setAllPrayersInMemory,
      setCache: vi.fn(),
      reapplyFilters: vi.fn(),
      setLoading: vi.fn(),
      setError,
      refreshBadges: vi.fn(),
      emitErrorToast,
      getLastErrorToastTime: () => 0,
      loadErrorToastCooldownMs: 60_000,
      isFetchInFlight: () => false,
      fetchApprovedFromDb,
    });

    expect(setError).toHaveBeenCalled();
    expect(emitErrorToast).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('runCommunityPrayerCatalogLoad shows loading on initial load', async () => {
    const setLoading = vi.fn();
    const fetchApprovedFromDb = vi.fn().mockResolvedValue([]);
    await runCommunityPrayerCatalogLoad({
      readCache: () => null,
      setFetchInFlight: vi.fn(),
      markDbFetchComplete: vi.fn(),
      setAllPrayersInMemory: vi.fn(),
      setCache: vi.fn(),
      reapplyFilters: vi.fn(),
      setLoading,
      setError: vi.fn(),
      refreshBadges: vi.fn(),
      emitErrorToast: vi.fn(),
      getLastErrorToastTime: () => 0,
      loadErrorToastCooldownMs: 60_000,
      isFetchInFlight: () => false,
      fetchApprovedFromDb,
    });
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
