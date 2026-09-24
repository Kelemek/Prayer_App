import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PrayerPersonalService } from './prayer-personal.service';
import type { PrayerRequest } from '../lib/prayer-types';
import * as personalDb from '../lib/prayer-personal-db';
import { orchestratePersonalPrayerOrderUpdate } from '../lib/prayer-personal-category-orchestrate';

vi.mock('../lib/prayer-personal-category-orchestrate', async (importOriginal) => {
  const mod =
    await importOriginal<typeof import('../lib/prayer-personal-category-orchestrate')>();
  return {
    ...mod,
    orchestratePersonalPrayerOrderUpdate: vi.fn(),
  };
});

vi.mock('../lib/prayer-personal-db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/prayer-personal-db')>();
  return {
    ...mod,
    fetchPersonalPrayersList: vi.fn(),
    fetchPersonalCategoriesList: vi.fn(),
    deletePersonalPrayerRow: vi.fn(),
    insertPersonalPrayerRow: vi.fn(),
    updatePersonalPrayerRow: vi.fn(),
  };
});

function prayer(id: string, count = 0): PrayerRequest {
  return {
    id,
    title: 't',
    description: 'd',
    status: 'current',
    prayed_for_count: count,
  } as PrayerRequest;
}

describe('PrayerPersonalService', () => {
  let service: PrayerPersonalService;
  let connectivity: { isOnline: ReturnType<typeof vi.fn>; requireOnline: ReturnType<typeof vi.fn> };
  let userSession: {
    getUserEmail: ReturnType<typeof vi.fn>;
    userSession$: { pipe: ReturnType<typeof vi.fn> };
    getCurrentSession: ReturnType<typeof vi.fn>;
  };
  let cache: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    getStale: ReturnType<typeof vi.fn>;
    invalidateCategory: ReturnType<typeof vi.fn>;
  };
  let tenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };
  let prayedForSync: {
    getPendingCount: ReturnType<typeof vi.fn>;
    displayCount: ReturnType<typeof vi.fn>;
    enqueue: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.mocked(personalDb.fetchPersonalPrayersList).mockResolvedValue({
      data: [],
      error: null,
    });
    vi.mocked(personalDb.fetchPersonalCategoriesList).mockResolvedValue({
      data: [{ id: 'c1', name: 'Health', display_order: 0, color: '#000' }],
      error: null,
    });
    connectivity = {
      isOnline: vi.fn(() => true),
      requireOnline: vi.fn(() => true),
    };
    userSession = {
      getUserEmail: vi.fn(() => 'user@example.com'),
      userSession$: { pipe: vi.fn() },
      getCurrentSession: vi.fn(),
    };
    cache = {
      set: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      getStale: vi.fn().mockReturnValue(null),
      invalidateCategory: vi.fn(),
    };
    tenantContext = {
      getActiveTenant: vi.fn(() => ({ id: 'tenant-1', slug: 'church' })),
    };
    prayedForSync = {
      getPendingCount: vi.fn(() => 0),
      displayCount: vi.fn((server: number) => server),
      enqueue: vi.fn(() => true),
      flush: vi.fn(),
    };
    service = new PrayerPersonalService(
      { client: { from: vi.fn() } } as never,
      { error: vi.fn(), success: vi.fn() } as never,
      cache as never,
      connectivity as never,
      tenantContext as never,
      prayedForSync as never,
      userSession as never,
      { notifyPersonalPrayerAdded: vi.fn() } as never,
      {
        getUserEmail: vi.fn(async () => 'user@example.com'),
        loadPersonalPrayers: vi.fn(async () => undefined),
      }
    );
  });

  it('exposes snapshot getters', () => {
    service.allPersonalPrayersSubject.next([prayer('p1')]);
    service.personalCategoriesSubject.next([
      { id: 'c1', name: 'Health', display_order: 0, color: '#000' },
    ]);
    expect(service.getPersonalPrayersSnapshot()).toHaveLength(1);
    expect(service.getPersonalCategoriesSnapshot()).toHaveLength(1);
    expect(service.getActiveTenantId()).toBe('tenant-1');
  });

  it('reads and writes personal prayer cache for active tenant', () => {
    const prayers = [prayer('p1')];
    service.setPersonalPrayersCache(prayers);
    expect(cache.set).toHaveBeenCalled();
    cache.get.mockReturnValue(prayers);
    expect(service.getPersonalPrayersCached()).toEqual(prayers);
    cache.getStale.mockReturnValue(prayers);
    expect(service.getStalePersonalPrayers()).toEqual(prayers);
  });

  it('clearCatalogOnLogout resets subjects and invalidates cache category', () => {
    service.allPersonalPrayersSubject.next([prayer('p1')]);
    service.clearCatalogOnLogout();
    expect(service.getPersonalPrayersSnapshot()).toEqual([]);
    expect(cache.invalidateCategory).toHaveBeenCalledWith('personalTenant_');
  });

  it('publishPersonalPrayers seeds counts and updates cache', () => {
    service.publishPersonalPrayers([prayer('p1', 4)]);
    expect(service.getPersonalPrayersSnapshot()[0].prayed_for_count).toBe(4);
    expect(cache.set).toHaveBeenCalled();
  });

  it('reprojectPersonalPrayers applies display counts', () => {
    service.seedPersonalServerCounts([prayer('p1', 2)]);
    service.allPersonalPrayersSubject.next([prayer('p1', 2)]);
    prayedForSync.displayCount.mockReturnValue(5);
    service.reprojectPersonalPrayers();
    expect(service.getPersonalPrayersSnapshot()[0].prayed_for_count).toBe(5);
  });

  it('isPersonalPrayerDisplayOrderOnlyChange delegates to display helper', () => {
    expect(
      service.isPersonalPrayerDisplayOrderOnlyChange(
        { title: 't', display_order: 1 },
        { title: 't', display_order: 2, updated_at: 'x' }
      )
    ).toBe(true);
  });

  it('incrementPersonalPrayedFor returns null without session email', async () => {
    userSession.getUserEmail.mockReturnValue(null);
    expect(await service.incrementPersonalPrayedFor('p1')).toBeNull();
  });

  it('incrementPersonalPrayedFor enqueues flush and returns display count', async () => {
    service.allPersonalPrayersSubject.next([prayer('p1', 1)]);
    service.seedPersonalServerCounts([prayer('p1', 1)]);
    const count = await service.incrementPersonalPrayedFor('p1');
    expect(prayedForSync.enqueue).toHaveBeenCalledWith('personal_prayer', 'p1');
    expect(prayedForSync.flush).toHaveBeenCalled();
    expect(count).toBe(1);
  });

  it('loadPersonalPrayers returns early without user email', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hooks = {
      getUserEmail: vi.fn(async () => null),
      loadPersonalPrayers: vi.fn(),
    };
    const svc = new PrayerPersonalService(
      { client: {} } as never,
      { error: vi.fn(), success: vi.fn() } as never,
      cache as never,
      connectivity as never,
      tenantContext as never,
      prayedForSync as never,
      userSession as never,
      { notifyPersonalPrayerAdded: vi.fn() } as never,
      hooks
    );
    await svc.loadPersonalPrayers();
    expect(svc.loadingPersonalPrayersSubject.value).toBe(false);
    expect(personalDb.fetchPersonalPrayersList).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('loadPersonalPrayers serves warm cache when offline', async () => {
    const cached = [prayer('cached-1', 0)];
    cache.get.mockReturnValue(cached);
    connectivity.isOnline.mockReturnValue(false);
    await service.loadPersonalPrayers();
    expect(service.getPersonalPrayersSnapshot()).toHaveLength(1);
    expect(personalDb.fetchPersonalPrayersList).not.toHaveBeenCalled();
  });

  it('loadPersonalCategories returns cached categories without refetch', async () => {
    service.personalCategoriesSubject.next([
      { id: 'c1', name: 'Health', display_order: 0, color: '#111' },
    ]);
    const cats = await service.loadPersonalCategories(false);
    expect(cats).toHaveLength(1);
    expect(personalDb.fetchPersonalCategoriesList).not.toHaveBeenCalled();
  });

  it('getPersonalPrayers loads from database when cache is empty', async () => {
    vi.mocked(personalDb.fetchPersonalPrayersList).mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'T',
          description: 'D',
          category_id: null,
          prayer_for: 'Me',
          user_email: 'user@example.com',
          display_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      error: null,
    });
    const prayers = await service.getPersonalPrayers(true);
    expect(prayers).toHaveLength(1);
    expect(personalDb.fetchPersonalPrayersList).toHaveBeenCalled();
  });

  it('loadPersonalPrayers fetches from database when online without warm cache', async () => {
    cache.get.mockReturnValue(null);
    vi.mocked(personalDb.fetchPersonalPrayersList).mockResolvedValue({
      data: [
        {
          id: 'p1',
          title: 'T',
          description: 'D',
          category_id: null,
          prayer_for: 'Me',
          user_email: 'user@example.com',
          display_order: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      error: null,
    });
    await service.loadPersonalPrayers();
    expect(service.getPersonalPrayersSnapshot()).toHaveLength(1);
    expect(service.loadingPersonalPrayersSubject.value).toBe(false);
  });

  it('loadPersonalPrayers clears list when offline without cache', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue(null);
    connectivity.isOnline.mockReturnValue(false);
    await service.loadPersonalPrayers();
    expect(service.getPersonalPrayersSnapshot()).toEqual([]);
  });

  it('loadPersonalPrayers uses cache on silent refresh without hitting database', async () => {
    const cached = [prayer('warm-1', 0)];
    cache.get.mockReturnValue(cached);
    await service.loadPersonalPrayers(true);
    expect(service.getPersonalPrayersSnapshot()).toHaveLength(1);
    expect(personalDb.fetchPersonalPrayersList).not.toHaveBeenCalled();
  });

  it('loadPersonalPrayers applies cache fallback after fetch failure', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cache.get.mockReturnValue(null);
    vi.mocked(personalDb.fetchPersonalPrayersList).mockResolvedValue({
      data: null,
      error: new Error('db down'),
    });
    const cached = [
      {
        ...prayer('fallback', 0),
        user_email: 'user@example.com',
        email: 'user@example.com',
      },
    ];
    cache.get.mockReturnValueOnce(null).mockReturnValue(cached);
    await service.loadPersonalPrayers();
    expect(service.getPersonalPrayersSnapshot()).toHaveLength(1);
    errSpy.mockRestore();
  });

  it('incrementPersonalPrayedFor returns null when enqueue fails', async () => {
    prayedForSync.enqueue.mockReturnValue(false);
    service.allPersonalPrayersSubject.next([prayer('p1', 1)]);
    expect(await service.incrementPersonalPrayedFor('p1')).toBeNull();
  });

  it('loadPersonalCategories skips fetch when offline', async () => {
    service.personalCategoriesSubject.next([]);
    connectivity.isOnline.mockReturnValue(false);
    await service.loadPersonalCategories(true);
    expect(personalDb.fetchPersonalCategoriesList).not.toHaveBeenCalled();
  });

  it('loadPersonalCategories logs and keeps state when RPC fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    service.personalCategoriesSubject.next([]);
    vi.mocked(personalDb.fetchPersonalCategoriesList).mockResolvedValue({
      data: null,
      error: new Error('categories fail'),
    });
    const cats = await service.loadPersonalCategories(true);
    expect(cats).toEqual([]);
    errSpy.mockRestore();
  });

  it('deletePersonalPrayer returns false when offline', async () => {
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.deletePersonalPrayer('p1')).toBe(false);
  });

  it('deletePersonalPrayer removes prayer when delete succeeds', async () => {
    service.allPersonalPrayersSubject.next([prayer('p1')]);
    vi.mocked(personalDb.deletePersonalPrayerRow).mockResolvedValue({ error: null });
    const toast = { error: vi.fn(), success: vi.fn() };
    const svc = new PrayerPersonalService(
      { client: {} } as never,
      toast as never,
      cache as never,
      connectivity as never,
      tenantContext as never,
      prayedForSync as never,
      userSession as never,
      { notifyPersonalPrayerAdded: vi.fn() } as never,
      {
        getUserEmail: vi.fn(async () => 'user@example.com'),
        loadPersonalPrayers: vi.fn(),
      }
    );
    svc.allPersonalPrayersSubject.next([prayer('p1')]);
    expect(await svc.deletePersonalPrayer('p1')).toBe(true);
    expect(svc.getPersonalPrayersSnapshot()).toHaveLength(0);
    expect(toast.success).toHaveBeenCalled();
  });

  it('updatePersonalPrayerOrder guards offline and missing tenant', async () => {
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.updatePersonalPrayerOrder([])).toBe(false);
    connectivity.requireOnline.mockReturnValue(true);
    tenantContext.getActiveTenant.mockReturnValue(null);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.updatePersonalPrayerOrder([])).toBe(false);
    errSpy.mockRestore();
  });

  it('updatePersonalPrayerOrder delegates to orchestration', async () => {
    vi.mocked(orchestratePersonalPrayerOrderUpdate).mockResolvedValue(true);
    const prayers = [prayer('p1')];
    expect(await service.updatePersonalPrayerOrder(prayers)).toBe(true);
    expect(orchestratePersonalPrayerOrderUpdate).toHaveBeenCalledWith(
      prayers,
      expect.any(Object)
    );
  });

  it('updatePersonalPrayer returns false when offline', async () => {
    connectivity.requireOnline.mockReturnValue(false);
    expect(await service.updatePersonalPrayer('p1', { title: 'x' })).toBe(false);
  });

  it('addPersonalPrayer returns false without user email', async () => {
    connectivity.requireOnline.mockReturnValue(true);
    const toast = { error: vi.fn(), success: vi.fn() };
    const hooks = {
      getUserEmail: vi.fn(async () => null),
      loadPersonalPrayers: vi.fn(),
    };
    const svc = new PrayerPersonalService(
      { client: {} } as never,
      toast as never,
      cache as never,
      connectivity as never,
      tenantContext as never,
      prayedForSync as never,
      userSession as never,
      { notifyPersonalPrayerAdded: vi.fn() } as never,
      hooks
    );
    expect(
      await svc.addPersonalPrayer({
        title: 't',
        description: 'd',
        status: 'current',
        prayer_for: 'me',
      } as never)
    ).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('addPersonalPrayer returns false when offline', async () => {
    connectivity.requireOnline.mockReturnValue(false);
    expect(
      await service.addPersonalPrayer({
        title: 't',
        description: 'd',
        status: 'current',
        prayer_for: 'me',
      } as never)
    ).toBe(false);
  });

  it('getPersonalPrayers returns empty array without email', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hooks = {
      getUserEmail: vi.fn(async () => null),
      loadPersonalPrayers: vi.fn(),
    };
    const svc = new PrayerPersonalService(
      { client: {} } as never,
      { error: vi.fn(), success: vi.fn() } as never,
      cache as never,
      connectivity as never,
      tenantContext as never,
      prayedForSync as never,
      userSession as never,
      { notifyPersonalPrayerAdded: vi.fn() } as never,
      hooks
    );
    expect(await svc.getPersonalPrayers()).toEqual([]);
    errSpy.mockRestore();
  });
});
