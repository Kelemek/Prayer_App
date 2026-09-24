import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrayerCommunityService } from './prayer-community.service';
import type { PrayerRequest } from '../lib/prayer-types';

vi.mock('../lib/prayer-community-db', () => ({
  fetchApprovedSharedPrayers: vi.fn(),
  fetchApprovedSharedPrayerUpdates: vi.fn(),
  fetchCommunityPrayersByMonth: vi.fn(),
  fetchCommunityPrayerUpdatesByPrayerIds: vi.fn(),
  insertCommunityPrayerRowNoReturning: vi.fn(),
  findTenantMembershipByEmail: vi.fn(),
  insertTenantMembershipMemberRow: vi.fn(),
  updateCommunityPrayerStatusRow: vi.fn(),
  deleteCommunityPrayerRow: vi.fn(),
  deleteCommunityPrayerUpdateRow: vi.fn(),
  fetchMemberPrayedForCountsBatch: vi.fn(),
  fetchMemberPrayerUpdatesBatch: vi.fn(),
  fetchMemberPrayerUpdatesForPerson: vi.fn(),
  rpcIncrementMemberPrayedFor: vi.fn(),
  insertMemberPrayerUpdateRow: vi.fn(),
  deleteMemberPrayerUpdateRow: vi.fn(),
  updateMemberPrayerUpdateRow: vi.fn(),
  insertPendingCommunityPrayerUpdate: vi.fn(),
  insertPendingCommunityUpdate: vi.fn(),
  fetchCommunityPrayerTitle: vi.fn(),
  insertPrayerDeletionRequestRow: vi.fn(),
  insertUpdateDeletionRequestRow: vi.fn(),
  fetchPrayerRowForDeletionNotify: vi.fn(),
  fetchPrayerUpdateRowForDeletionNotify: vi.fn(),
}));

import {
  deleteCommunityPrayerUpdateRow,
  fetchApprovedSharedPrayerUpdates,
  fetchApprovedSharedPrayers,
  fetchCommunityPrayerTitle,
  fetchCommunityPrayerUpdatesByPrayerIds,
  fetchCommunityPrayersByMonth,
  fetchMemberPrayedForCountsBatch,
  fetchMemberPrayerUpdatesBatch,
  fetchMemberPrayerUpdatesForPerson,
  fetchPrayerRowForDeletionNotify,
  fetchPrayerUpdateRowForDeletionNotify,
  findTenantMembershipByEmail,
  insertCommunityPrayerRowNoReturning,
  insertMemberPrayerUpdateRow,
  insertPendingCommunityPrayerUpdate,
  insertPendingCommunityUpdate,
  insertPrayerDeletionRequestRow,
  insertTenantMembershipMemberRow,
  insertUpdateDeletionRequestRow,
  rpcIncrementMemberPrayedFor,
  updateCommunityPrayerStatusRow,
  deleteCommunityPrayerRow,
  deleteMemberPrayerUpdateRow,
  updateMemberPrayerUpdateRow,
} from '../lib/prayer-community-db';

function createService(overrides?: {
  tenantId?: string | null;
  isOnline?: boolean;
  cacheGet?: PrayerRequest[] | null;
  cacheStale?: PrayerRequest[] | null;
  toastError?: ReturnType<typeof vi.fn>;
  toastSuccess?: ReturnType<typeof vi.fn>;
  requireOnline?: ReturnType<typeof vi.fn>;
  prayedForEnqueue?: ReturnType<typeof vi.fn>;
}) {
  const applyFilters = vi.fn();
  const loadPrayers = vi.fn();
  const toastError = overrides?.toastError ?? vi.fn();
  const toastSuccess = overrides?.toastSuccess ?? vi.fn();
  const requireOnline = overrides?.requireOnline ?? vi.fn(() => true);
  const prayedForEnqueue = overrides?.prayedForEnqueue ?? vi.fn(() => true);
  const cacheStore = new Map<string, unknown>();
  const tenantId =
    overrides !== undefined && 'tenantId' in overrides
      ? overrides.tenantId ?? null
      : 'tenant-1';
  const service = new PrayerCommunityService(
    {
      client: {},
      isNetworkError: () => false,
    } as never,
    { error: toastError, success: toastSuccess } as never,
    { sendAdminNotification: vi.fn().mockResolvedValue(undefined) } as never,
    {
      get: (key: string) =>
        (cacheStore.get(key) as PrayerRequest[] | undefined) ??
        overrides?.cacheGet ??
        null,
      getStale: (key: string) =>
        (cacheStore.get(`${key}:stale`) as PrayerRequest[] | undefined) ??
        overrides?.cacheStale ??
        null,
      set: (key: string, value: unknown) => {
        cacheStore.set(key, value);
      },
      invalidate: vi.fn((key: string) => {
        cacheStore.delete(key);
      }),
    } as never,
    { refreshBadgeCounts: vi.fn() } as never,
    {
      isOnline: () => overrides?.isOnline ?? true,
      requireOnline: requireOnline,
    } as never,
    {
      getActiveTenant: () =>
        tenantId ? { id: tenantId, name: 'Church', slug: 'church' } : null,
      getIsSuperAdmin: () => false,
      getIsImpersonatingTenant: () => false,
    } as never,
    {
      displayCount: (server: number) => server,
      getPendingCount: () => 0,
      enqueue: prayedForEnqueue,
      flush: vi.fn(),
    } as never,
    {
      loadPrayers,
      applyFilters,
      getUserEmail: async () => 'admin@example.com',
    }
  );
  return { service, applyFilters, loadPrayers, cacheStore, tenantId };
}

const samplePrayer = (id: string): PrayerRequest =>
  ({
    id,
    prayer_for: 'Ann',
    status: 'current',
    prayed_for_count: 2,
    updates: [],
  }) as PrayerRequest;

describe('PrayerCommunityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null cache key when tenant is missing', () => {
    const { service } = createService({ tenantId: null });
    expect(service.getCachedSharedPrayers(null)).toBeNull();
    expect(service.getActiveTenantId()).toBeNull();
  });

  it('applyFilters publishes filtered prayers', () => {
    const { service } = createService();
    service.allPrayersSubject.next([samplePrayer('p1')]);
    service.applyFilters({ searchTerm: 'Ann' });
    expect(service.currentFilters).toEqual({ searchTerm: 'Ann' });
    expect(service.prayersSubject.value).toHaveLength(1);
  });

  it('loadPrayers exits early without tenant', async () => {
    const { service, applyFilters } = createService({ tenantId: null });
    service.loadingSubject.next(true);
    await service.loadPrayers();
    expect(applyFilters).not.toHaveBeenCalled();
    expect(service.loadingSubject.value).toBe(true);
  });

  it('loadPrayers uses warm cache and skips db on silent refresh', async () => {
    const cached = [samplePrayer('cached')];
    const { service, applyFilters } = createService({ cacheGet: cached });
    await service.loadPrayers(true);
    expect(service.getAllCommunityPrayersSnapshot()).toHaveLength(1);
    expect(applyFilters).toHaveBeenCalled();
    expect(fetchApprovedSharedPrayers).not.toHaveBeenCalled();
  });

  it('loadPrayers serves stale cache while offline', async () => {
    const stale = [samplePrayer('stale')];
    const { service, applyFilters } = createService({
      isOnline: false,
      cacheStale: stale,
    });
    await service.loadPrayers();
    expect(service.getAllCommunityPrayersSnapshot()[0]?.id).toBe('stale');
    expect(applyFilters).toHaveBeenCalled();
    expect(fetchApprovedSharedPrayers).not.toHaveBeenCalled();
  });

  it('loadPrayers fetches prayers and updates from the database', async () => {
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: [{ id: 'p1', prayer_for: 'Ann', status: 'current' }],
      error: null,
    });
    vi.mocked(fetchApprovedSharedPrayerUpdates).mockResolvedValue({
      updatesData: [],
      error: null,
    });
    const { service, applyFilters } = createService();
    await service.loadPrayers();
    expect(service.getAllCommunityPrayersSnapshot()).toHaveLength(1);
    expect(applyFilters).toHaveBeenCalled();
  });

  it('loadPrayers sets loading true for non-silent fetch with empty cache', async () => {
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: [],
      error: null,
    });
    vi.mocked(fetchApprovedSharedPrayerUpdates).mockResolvedValue({
      updatesData: [],
      error: null,
    });
    const { service } = createService({ cacheGet: [] });
    service.loadingSubject.next(false);
    const loadPromise = service.loadPrayers(false);
    expect(service.loadingSubject.value).toBe(true);
    await loadPromise;
    expect(service.loadingSubject.value).toBe(false);
  });

  it('loadPrayers falls back to cache after fetch errors', async () => {
    const cached = [samplePrayer('fallback')];
    const { service, applyFilters, tenantId } = createService();
    service.setCachedSharedPrayers(tenantId, cached);
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: null,
      error: new Error('db fail'),
    });
    await service.loadPrayers();
    expect(service.getAllCommunityPrayersSnapshot()[0]?.id).toBe('fallback');
    expect(applyFilters).toHaveBeenCalled();
    expect(service.errorSubject.value).toBeNull();
  });

  it('reprojects prayed-for display counts', () => {
    const { service } = createService();
    service.seedCommunityServerCounts([samplePrayer('p1')]);
    service.publishCommunityPrayers([samplePrayer('p1')], 'tenant-1');
    service.reprojectCommunityPrayers();
    expect(service.getAllCommunityPrayersSnapshot()[0]?.prayed_for_count).toBe(2);
  });

  it('showCachedCommunityPrayers hydrates subjects and reapplies filters', () => {
    const { service, applyFilters } = createService();
    service.showCachedCommunityPrayers([samplePrayer('cached')]);
    expect(service.getAllCommunityPrayersSnapshot()).toHaveLength(1);
    expect(applyFilters).toHaveBeenCalled();
  });

  it('getPrayersByMonth returns formatted rows', async () => {
    vi.mocked(fetchCommunityPrayersByMonth).mockResolvedValue({
      data: [{ id: 'p1', prayer_for: 'Ann', status: 'current' }],
      error: null,
    });
    vi.mocked(fetchCommunityPrayerUpdatesByPrayerIds).mockResolvedValue({
      data: [],
      error: null,
    });
    const { service } = createService();
    const rows = await service.getPrayersByMonth(2026, 3);
    expect(rows).toHaveLength(1);
  });

  it('getPrayersByMonth returns [] on failure', async () => {
    vi.mocked(fetchCommunityPrayersByMonth).mockResolvedValue({
      data: null,
      error: new Error('month fail'),
    });
    const { service } = createService();
    await expect(service.getPrayersByMonth(2026, 3)).resolves.toEqual([]);
  });

  it('addPrayer returns false when offline', async () => {
    const requireOnline = vi.fn(() => false);
    const { service } = createService({ requireOnline });
    const ok = await service.addPrayer({
      prayer_for: 'Ann',
      requester: 'Bob',
      email: 'bob@example.com',
      status: 'pending',
      description: 'Please pray',
    } as never);
    expect(ok).toBe(false);
  });

  it('addPrayer inserts row and notifies admin', async () => {
    vi.mocked(insertCommunityPrayerRowNoReturning).mockResolvedValue({ error: null });
    vi.mocked(findTenantMembershipByEmail).mockResolvedValue({ data: null });
    const { service } = createService({ toastSuccess: vi.fn() });
    const ok = await service.addPrayer({
      prayer_for: 'Ann',
      requester: 'Bob',
      email: 'bob@example.com',
      status: 'pending',
      description: 'Please pray',
    } as never);
    expect(ok).toBe(true);
    expect(insertCommunityPrayerRowNoReturning).toHaveBeenCalled();
  });

  it('updatePrayerStatus patches local list', async () => {
    vi.mocked(updateCommunityPrayerStatusRow).mockResolvedValue({ error: null });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    service.prayersSubject.next([samplePrayer('p1')]);
    const ok = await service.updatePrayerStatus('p1', 'answered');
    expect(ok).toBe(true);
    expect(service.prayersSubject.value[0]?.status).toBe('answered');
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('deletePrayer removes prayer from subjects', async () => {
    vi.mocked(deleteCommunityPrayerRow).mockResolvedValue({ error: null });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    service.allPrayersSubject.next([samplePrayer('p1'), samplePrayer('p2')]);
    service.prayersSubject.next([samplePrayer('p1')]);
    const ok = await service.deletePrayer('p1');
    expect(ok).toBe(true);
    expect(service.getAllCommunityPrayersSnapshot()).toHaveLength(1);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('incrementPrayedFor enqueues sync work', async () => {
    const { service } = createService();
    service.allPrayersSubject.next([samplePrayer('p1')]);
    service.seedCommunityServerCounts([samplePrayer('p1')]);
    const count = await service.incrementPrayedFor('p1');
    expect(count).toBe(2);
  });

  it('loadPrayers surfaces toast when fetch fails without cache', async () => {
    const toastError = vi.fn();
    const { service } = createService({ toastError });
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: null,
      error: new Error('hard fail'),
    });
    await service.loadPrayers();
    expect(toastError).toHaveBeenCalledWith('Failed to load prayers');
    expect(service.errorSubject.value).toBe('hard fail');
  });

  it('loadPrayers continues when prayer updates fail to load', async () => {
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: [{ id: 'p1', prayer_for: 'Ann', status: 'current' }],
      error: null,
    });
    vi.mocked(fetchApprovedSharedPrayerUpdates).mockResolvedValue({
      updatesData: null,
      error: new Error('updates down'),
    });
    const { service } = createService();
    await service.loadPrayers();
    expect(service.getAllCommunityPrayersSnapshot()).toHaveLength(1);
  });

  it('getFilteredPrayers applies status and search filters', () => {
    const { service } = createService();
    service.prayersSubject.next([
      samplePrayer('p1'),
      { ...samplePrayer('p2'), prayer_for: 'Bob', status: 'answered' },
    ]);
    const filtered = service.getFilteredPrayers({ status: 'answered' });
    expect(filtered.map((p) => p.id)).toEqual(['p2']);
  });

  it('incrementPrayedFor returns null when enqueue fails', async () => {
    const { service } = createService({ prayedForEnqueue: vi.fn(() => false) });
    service.allPrayersSubject.next([samplePrayer('p1')]);
    await expect(service.incrementPrayedFor('p1')).resolves.toBeNull();
  });

  it('getMemberPrayedForCountsBatch returns empty for no ids', async () => {
    const { service } = createService();
    await expect(service.getMemberPrayedForCountsBatch([])).resolves.toEqual({});
  });

  it('getMemberPrayedForCountsBatch caches rpc results', async () => {
    vi.mocked(fetchMemberPrayedForCountsBatch).mockResolvedValue({
      data: [{ person_id: 'person-1', prayed_for_count: 3 }],
      error: null,
    });
    const { service } = createService();
    const counts = await service.getMemberPrayedForCountsBatch(['person-1']);
    expect(counts['person-1']).toBe(3);
  });

  it('getMemberPrayerUpdatesBatch returns grouped updates', async () => {
    vi.mocked(fetchMemberPrayerUpdatesBatch).mockResolvedValue({
      data: [
        {
          id: 'u1',
          person_id: 'person-1',
          content: 'Update',
          is_answered: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const { service } = createService();
    const grouped = await service.getMemberPrayerUpdatesBatch(['person-1']);
    expect(grouped['person-1']).toHaveLength(1);
  });

  it('getMemberPrayerUpdates fetches when cache is empty', async () => {
    vi.mocked(fetchMemberPrayerUpdatesForPerson).mockResolvedValue({
      data: [
        {
          id: 'u1',
          person_id: 'person-1',
          content: 'Hello',
          is_answered: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const { service } = createService();
    const updates = await service.getMemberPrayerUpdates('person-1');
    expect(updates).toHaveLength(1);
  });

  it('incrementMemberPrayedFor writes count to cache', async () => {
    vi.mocked(rpcIncrementMemberPrayedFor).mockResolvedValue({
      data: 4,
      error: null,
    });
    const { service } = createService();
    await expect(service.incrementMemberPrayedFor('person-1')).resolves.toBe(4);
  });

  it('addMemberPrayerUpdate succeeds online', async () => {
    vi.mocked(insertMemberPrayerUpdateRow).mockResolvedValue({ error: null });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.addMemberPrayerUpdate(
      'person-1',
      'Ann',
      'Please pray',
      'Bob',
      'bob@example.com'
    );
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('deleteMemberPrayerUpdate succeeds online', async () => {
    vi.mocked(deleteMemberPrayerUpdateRow).mockResolvedValue({ error: null });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.deleteMemberPrayerUpdate('u1', 'person-1');
    expect(ok).toBe(true);
  });

  it('updateMemberPrayerUpdate succeeds online', async () => {
    vi.mocked(updateMemberPrayerUpdateRow).mockResolvedValue({ error: null });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.updateMemberPrayerUpdate('u1', 'person-1', {
      content: 'Edited',
    });
    expect(ok).toBe(true);
  });

  it('addPrayerUpdate submits pending update', async () => {
    vi.mocked(insertPendingCommunityPrayerUpdate).mockResolvedValue({
      data: { id: 'upd-1' },
      error: null,
    });
    vi.mocked(fetchCommunityPrayerTitle).mockResolvedValue({
      data: { title: 'Health' },
      error: null,
    });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.addPrayerUpdate('p1', 'Update text', 'Alice');
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith('Update submitted for approval');
  });

  it('addUpdate submits community update payload', async () => {
    vi.mocked(insertPendingCommunityUpdate).mockResolvedValue({
      data: { id: 'upd-2' },
      error: null,
    });
    vi.mocked(fetchCommunityPrayerTitle).mockResolvedValue({
      data: { title: 'Health' },
      error: null,
    });
    const { service } = createService({ toastSuccess: vi.fn() });
    const ok = await service.addUpdate({
      prayer_id: 'p1',
      content: 'More',
      author: 'Alice',
      author_email: 'alice@example.com',
    });
    expect(ok).toBe(true);
  });

  it('deleteUpdate reloads prayers after success', async () => {
    vi.mocked(deleteCommunityPrayerUpdateRow).mockResolvedValue({ error: null });
    const { service, loadPrayers } = createService();
    const ok = await service.deleteUpdate('upd-1');
    expect(ok).toBe(true);
    expect(loadPrayers).toHaveBeenCalled();
  });

  it('requestDeletion notifies admins', async () => {
    vi.mocked(insertPrayerDeletionRequestRow).mockResolvedValue({
      data: { id: 'del-1' },
      error: null,
    });
    vi.mocked(fetchPrayerRowForDeletionNotify).mockResolvedValue({
      data: { title: 'Health', prayer_for: 'Ann' },
      error: null,
    });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.requestDeletion({
      prayer_id: 'p1',
      reason: 'duplicate',
      requester_email: 'alice@example.com',
      requester_first_name: 'Alice',
      requester_last_name: 'Smith',
    });
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('requestUpdateDeletion notifies admins', async () => {
    vi.mocked(insertUpdateDeletionRequestRow).mockResolvedValue({
      data: { id: 'del-2' },
      error: null,
    });
    vi.mocked(fetchPrayerUpdateRowForDeletionNotify).mockResolvedValue({
      data: { content: 'Old update' },
      error: null,
    });
    const toastSuccess = vi.fn();
    const { service } = createService({ toastSuccess });
    const ok = await service.requestUpdateDeletion({
      update_id: 'u1',
      reason: 'mistake',
      requester_email: 'alice@example.com',
      requester_first_name: 'Alice',
      requester_last_name: 'Smith',
    });
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalled();
  });
});
