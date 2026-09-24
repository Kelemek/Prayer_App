import { describe, expect, it, vi } from 'vitest';
import {
  emptyInAppBadgeReadState,
  inAppBadgeItemSnapshotKey,
} from './in-app-prayer-badge-count';
import {
  createLocalStorageAllTenantInAppBadgeHydrateDeps,
  hydrateMissingTenantInAppBadgeCaches,
  loadInAppBadgePrayerItems,
  loadInAppBadgePromptItems,
  loadInAppBadgeReceipts,
  mergeReceiptsIntoReadState,
  receiptsToReadState,
  tenantHasInAppBadgeItemCache,
} from './all-tenant-in-app-badge-hydrate';

vi.mock('./prayer-community-db', () => ({
  fetchApprovedSharedPrayers: vi.fn(),
  fetchApprovedSharedPrayerUpdates: vi.fn(),
}));

import {
  fetchApprovedSharedPrayerUpdates,
  fetchApprovedSharedPrayers,
} from './prayer-community-db';

describe('all-tenant in-app badge hydrate', () => {
  it('maps receipt rows into read-state buckets', () => {
    expect(
      receiptsToReadState([
        { item_kind: 'prayer', item_id: 'p1' },
        { item_kind: 'prayer_update', item_id: 'u1' },
        { item_kind: 'prompt', item_id: 'pr1' },
        { item_kind: 'prompt_update', item_id: 'pu1' },
      ])
    ).toEqual({
      prayers: ['p1'],
      prayerUpdates: ['u1'],
      prompts: ['pr1'],
      promptUpdates: ['pu1'],
    });
  });

  it('unions remote receipts with optimistic local marks', () => {
    const merged = mergeReceiptsIntoReadState(
      { ...emptyInAppBadgeReadState(), prayers: ['local'] },
      [{ item_kind: 'prayer', item_id: 'remote' }]
    );
    expect(merged.prayers).toEqual(expect.arrayContaining(['local', 'remote']));
  });

  it('skips the active tenant and fills missing caches for others', async () => {
    const writeReadState = vi.fn();
    const writePrayerCache = vi.fn();
    const writePromptCache = vi.fn();
    const hydrated = await hydrateMissingTenantInAppBadgeCaches({
      tenantIds: ['active', 'other'],
      skipTenantId: 'active',
      email: 'member@example.com',
      hasPrayerCache: () => false,
      hasPromptCache: () => false,
      readStoredReadState: () => emptyInAppBadgeReadState(),
      writeReadState,
      writePrayerCache,
      writePromptCache,
      loadReceipts: async () => [{ item_kind: 'prayer', item_id: 'p-other' }],
      loadPrayers: async () => [{ id: 'p-other', status: 'current' }],
      loadPrompts: async () => [{ id: 'pr-other' }],
    });

    expect(hydrated).toEqual(['other']);
    expect(writeReadState).toHaveBeenCalledWith(
      'other',
      expect.objectContaining({ prayers: ['p-other'] })
    );
    expect(writePrayerCache).toHaveBeenCalledWith('other', [
      { id: 'p-other', status: 'current' },
    ]);
    expect(writePromptCache).toHaveBeenCalledWith('other', [{ id: 'pr-other' }]);
  });

  it('does not refetch item caches that already exist', async () => {
    const loadPrayers = vi.fn(async () => []);
    const loadPrompts = vi.fn(async () => []);
    await hydrateMissingTenantInAppBadgeCaches({
      tenantIds: ['other'],
      email: 'member@example.com',
      hasPrayerCache: () => true,
      hasPromptCache: () => true,
      readStoredReadState: () => emptyInAppBadgeReadState(),
      writeReadState: vi.fn(),
      writePrayerCache: vi.fn(),
      writePromptCache: vi.fn(),
      loadReceipts: async () => [],
      loadPrayers,
      loadPrompts,
    });
    expect(loadPrayers).not.toHaveBeenCalled();
    expect(loadPrompts).not.toHaveBeenCalled();
  });

  it('continues after a tenant hydrate failure', async () => {
    const hydrated = await hydrateMissingTenantInAppBadgeCaches({
      tenantIds: ['bad', 'good'],
      email: 'member@example.com',
      hasPrayerCache: () => true,
      hasPromptCache: () => true,
      readStoredReadState: () => emptyInAppBadgeReadState(),
      writeReadState: vi.fn(),
      writePrayerCache: vi.fn(),
      writePromptCache: vi.fn(),
      loadReceipts: async (tenantId) => {
        if (tenantId === 'bad') {
          throw new Error('network');
        }
        return [];
      },
      loadPrayers: async () => [],
      loadPrompts: async () => [],
    });
    expect(hydrated).toEqual(['good']);
  });

  it('loadInAppBadgeReceipts calls badge read receipts rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ item_kind: 'prayer', item_id: 'p1' }],
      error: null,
    });
    const rows = await loadInAppBadgeReceipts(
      { rpc } as never,
      'tenant-1',
      'user@example.com'
    );
    expect(rows).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('get_badge_read_receipts', {
      p_tenant_id: 'tenant-1',
      p_user_email: 'user@example.com',
    });
  });

  it('returns no tenants when email is blank', async () => {
    const hydrated = await hydrateMissingTenantInAppBadgeCaches({
      tenantIds: ['a'],
      email: '   ',
      hasPrayerCache: () => false,
      hasPromptCache: () => false,
      readStoredReadState: () => emptyInAppBadgeReadState(),
      writeReadState: vi.fn(),
      writePrayerCache: vi.fn(),
      writePromptCache: vi.fn(),
      loadReceipts: async () => [],
      loadPrayers: async () => [],
      loadPrompts: async () => [],
    });
    expect(hydrated).toEqual([]);
  });

  it('tenantHasInAppBadgeItemCache checks list and snapshot keys', () => {
    const storage = {
      getItem: vi.fn((key: string) =>
        key.includes('badge_items') ? '[]' : null
      ),
    };
    expect(tenantHasInAppBadgeItemCache(storage, 't1', 'prayers')).toBe(true);
    expect(tenantHasInAppBadgeItemCache({ getItem: () => null }, 't1', 'prompts')).toBe(
      false
    );
  });

  it('writes badge-owned snapshots instead of list-page caches', async () => {
    const storage = new Map<string, string>();
    const deps = createLocalStorageAllTenantInAppBadgeHydrateDeps({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
      },
      client: {
        rpc: async () => ({
          data: [{ item_kind: 'prayer', item_id: 'p-snap' }],
          error: null,
        }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: [{ name: 'daily' }], error: null }),
            }),
          }),
        }),
      } as never,
      email: 'member@example.com',
      tenantIds: ['other'],
    });
    deps.loadPrayers = async () => [{ id: 'p-snap', status: 'current' }];
    deps.loadPrompts = async () => [{ id: 'pr-snap' }];

    await hydrateMissingTenantInAppBadgeCaches(deps);

    expect(storage.has('tenant_other_prayers')).toBe(false);
    expect(storage.has('prompts:other')).toBe(false);
    expect(
      storage.get(inAppBadgeItemSnapshotKey('other', 'prayers'))
    ).toContain('p-snap');
    expect(
      storage.get(inAppBadgeItemSnapshotKey('other', 'prompts'))
    ).toContain('pr-snap');
  });

  it('loadInAppBadgeReceipts throws on rpc error', async () => {
    await expect(
      loadInAppBadgeReceipts(
        {
          rpc: async () => ({ data: null, error: new Error('rpc fail') }),
        } as never,
        'tenant-1',
        'user@example.com'
      )
    ).rejects.toThrow('rpc fail');
  });

  it('loadInAppBadgePrayerItems maps approved prayers and updates', async () => {
    vi.mocked(fetchApprovedSharedPrayers).mockResolvedValue({
      prayersData: [{ id: 'p1', prayer_for: 'Ann', status: 'current', updates: [] }],
      error: null,
    });
    vi.mocked(fetchApprovedSharedPrayerUpdates).mockResolvedValue({
      updatesData: [],
      error: null,
    });
    const items = await loadInAppBadgePrayerItems({} as never, 'tenant-1');
    expect(items.map((i) => i.id)).toEqual(['p1']);
  });

  it('loadInAppBadgePromptItems filters inactive prompt types', async () => {
    const client = {
      from: (table: string) => {
        if (table === 'prayer_types') {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [{ name: 'Morning' }], error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { id: 'pr1', type: 'Morning' },
                { id: 'pr2', type: 'Evening' },
              ],
              error: null,
            }),
          }),
        };
      },
    };
    const items = await loadInAppBadgePromptItems(client as never, 'tenant-1');
    expect(items).toEqual([{ id: 'pr1' }]);
  });

  it('loadInAppBadgePromptItems returns [] when client tables are missing', async () => {
    const items = await loadInAppBadgePromptItems({ from: () => ({}) } as never, 't');
    expect(items).toEqual([]);
  });

  it('createLocalStorageAllTenantInAppBadgeHydrateDeps wires storage helpers', async () => {
    const storage = new Map<string, string>();
    const deps = createLocalStorageAllTenantInAppBadgeHydrateDeps({
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      client: { rpc: async () => ({ data: [], error: null }) } as never,
      email: ' User@Example.com ',
      tenantIds: ['t1'],
      skipTenantId: 'active',
    });
    expect(deps.email).toBe('user@example.com');
    expect(deps.hasPrayerCache('t1')).toBe(false);
    deps.writeReadState('t1', emptyInAppBadgeReadState());
    expect(storage.size).toBeGreaterThan(0);
  });
});
