import { describe, expect, it, vi } from 'vitest';
import {
  emptyInAppBadgeReadState,
  inAppBadgeItemSnapshotKey,
} from './in-app-prayer-badge-count';
import {
  createLocalStorageAllTenantInAppBadgeHydrateDeps,
  hydrateMissingTenantInAppBadgeCaches,
  mergeReceiptsIntoReadState,
  receiptsToReadState,
} from './all-tenant-in-app-badge-hydrate';

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
});
