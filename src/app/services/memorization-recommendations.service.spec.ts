import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { MemorizationRecommendationsService } from './memorization-recommendations.service';

const CAT_ID = 'cat-general';

const TENANT_ID = 'tenant-1';

function makeCategoryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CAT_ID,
    tenant_id: TENANT_ID,
    name: 'General',
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    tenant_id: TENANT_ID,
    reference: 'John 3:16',
    category_id: CAT_ID,
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MemorizationRecommendationsService', () => {
  let service: MemorizationRecommendationsService;
  let fromMock: ReturnType<typeof vi.fn>;
  let rpcMock: ReturnType<typeof vi.fn>;
  let cache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };

  function selectEqOrder(data: unknown) {
    return {
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    };
  }

  beforeEach(() => {
    fromMock = vi.fn();
    rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    cache = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      invalidate: vi.fn(),
    };
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue(selectEqOrder([])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    });
    const supabase = { client: { from: fromMock, rpc: rpcMock } };
    const tenantContext = {
      getActiveTenant: vi.fn(() => ({ id: TENANT_ID })),
      activeTenant$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    };
    service = new MemorizationRecommendationsService(
      supabase as any,
      cache as any,
      tenantContext as any
    );
    fromMock.mockClear();
    rpcMock.mockClear();
    cache.get.mockClear();
    cache.set.mockClear();
    cache.invalidate.mockClear();
  });

  function mockLoadTables(
    categories: ReturnType<typeof makeCategoryRow>[],
    items: ReturnType<typeof makeRow>[]
  ): void {
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendation_categories') {
        return {
          select: vi.fn().mockReturnValue(selectEqOrder(categories)),
          insert: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
      }
      return {
        select: vi.fn().mockReturnValue(selectEqOrder(items)),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
    });
  }

  function mockDeferredLoad(
    categories: ReturnType<typeof makeCategoryRow>[],
    items: ReturnType<typeof makeRow>[]
  ): { resolve: () => void; promise: Promise<void> } {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    fromMock.mockImplementation((table: string) => {
      const data =
        table === 'memorization_recommendation_categories' ? categories : items;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockImplementation(async () => {
              await gate;
              return { data, error: null };
            }),
          }),
        }),
      };
    });
    return { resolve: () => resolve(), promise: gate };
  }

  it('load maps categories and items into grouped snapshot and caches both', async () => {
    mockLoadTables(
      [makeCategoryRow()],
      [
        makeRow({ id: 'a', reference: 'Romans 8:28', display_order: 0 }),
        makeRow({ id: 'b', reference: 'John 3:16', display_order: 1 }),
      ]
    );

    const groups = await service.load(true);

    expect(groups).toHaveLength(1);
    expect(groups[0].category.name).toBe('General');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].items[0].reference).toBe('Romans 8:28');
    expect(groups[0].items[0].categoryId).toBe(CAT_ID);
    expect(cache.invalidate).toHaveBeenCalledWith(`memorizationRecommendations:${TENANT_ID}`);
    expect(cache.set).toHaveBeenCalledWith(
      `memorizationRecommendations:${TENANT_ID}`,
      expect.objectContaining({
        categories: expect.any(Array),
        items: expect.any(Array),
      }),
      60 * 60 * 1000
    );
    expect(service.groupedSnapshot).toEqual(groups);
  });

  it('ignores stale load results when a newer load finishes first', async () => {
    const stale = mockDeferredLoad(
      [makeCategoryRow({ name: 'Stale' })],
      [makeRow({ id: 'stale', reference: 'Stale 1:1' })]
    );
    const stalePromise = service.load(true);

    mockLoadTables(
      [makeCategoryRow({ name: 'Fresh' })],
      [makeRow({ id: 'fresh', reference: 'Fresh 1:1' })]
    );
    const freshGroups = await service.load(true);
    expect(freshGroups[0].category.name).toBe('Fresh');
    expect(service.snapshot[0].reference).toBe('Fresh 1:1');

    stale.resolve();
    await stalePromise;

    expect(service.snapshot[0].reference).toBe('Fresh 1:1');
    expect(service.categoriesSnapshot[0].name).toBe('Fresh');
  });

  it('keeps prior data when force load fails', async () => {
    mockLoadTables(
      [makeCategoryRow()],
      [makeRow({ reference: 'John 3:16' })]
    );
    await service.load(true);
    expect(service.snapshot).toHaveLength(1);
    cache.invalidate.mockClear();

    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'network' },
          })
        }),
      }),
    }));

    const groups = await service.load(true);
    expect(groups[0].items[0].reference).toBe('John 3:16');
    expect(service.snapshot).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('invalidateCache uses the same logical key as get/set', () => {
    service.invalidateCache();
    expect(cache.invalidate).toHaveBeenCalledWith(`memorizationRecommendations:${TENANT_ID}`);
  });

  it('addRecommendation requires categoryId', async () => {
    const result = await service.addRecommendation('John 3:16', '  ');
    expect(result).toEqual({ ok: false, reason: 'missing_category' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('addRecommendation inserts with category_id and reloads', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: makeRow({ id: 'new', reference: 'Psalm 23:1', display_order: 0 }),
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendations') {
        return {
          insert,
          select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
              order: vi
                .fn()
                .mockResolvedValue({
                  data: [makeRow({ id: 'new', reference: 'Psalm 23:1' })],
                  error: null,
                })
              }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [makeCategoryRow()], error: null }),
          }),
        }),
      };
    });

    const result = await service.addRecommendation('Psalm 23:1', CAT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.reference).toBe('Psalm 23:1');
      expect(result.item.categoryId).toBe(CAT_ID);
    }
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        reference: 'Psalm 23:1',
        category_id: CAT_ID,
      })
    );
    expect(cache.invalidate).toHaveBeenCalled();
  });

  it('addRecommendation returns duplicate on unique violation', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    });
    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: insertSingle }),
      }),
    });

    const result = await service.addRecommendation('John 3:16', CAT_ID);
    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('addRecommendation rejects empty reference', async () => {
    const result = await service.addRecommendation('   ', CAT_ID);
    expect(result).toEqual({ ok: false, reason: 'empty_reference' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('addCategory inserts and reloads', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: makeCategoryRow({ id: 'cat-2', name: 'Comfort', display_order: 1 }),
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendation_categories') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: insertSingle }),
          }),
          select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  makeCategoryRow(),
                  makeCategoryRow({ id: 'cat-2', name: 'Comfort', display_order: 1 }),
                ],
                error: null,
              })
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await service.addCategory('Comfort');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.category.name).toBe('Comfort');
    }
  });

  it('addCategory keeps local category when reload fails after insert', async () => {
    mockLoadTables([makeCategoryRow()], []);
    await service.load(true);

    const insertSingle = vi.fn().mockResolvedValue({
      data: makeCategoryRow({ id: 'cat-2', name: 'Comfort', display_order: 1 }),
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendation_categories') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: insertSingle }),
          }),
          select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'network' },
              })
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'network' },
            })
          }),
        }),
      };
    });

    const result = await service.addCategory('Comfort');
    expect(result.ok).toBe(true);
    expect(service.categoriesSnapshot.map((c) => c.name)).toEqual([
      'General',
      'Comfort',
    ]);
  });

  it('removeRecommendation keeps local removal when reload fails after delete', async () => {
    mockLoadTables([makeCategoryRow()], [makeRow({ id: 'rec-1' })]);
    await service.load(true);

    const delEq = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendations') {
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: delEq }) }),
          select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'network' },
              })
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'network' },
            })
          }),
        }),
      };
    });

    const ok = await service.removeRecommendation('rec-1');
    expect(ok).toBe(true);
    expect(service.snapshot).toHaveLength(0);
  });

  it('deleteCategory blocks when category still has verses', async () => {
    mockLoadTables(
      [makeCategoryRow()],
      [makeRow({ category_id: CAT_ID })]
    );
    await service.load(true);
    fromMock.mockClear();

    const result = await service.deleteCategory(CAT_ID);
    expect(result).toEqual({ ok: false, reason: 'not_empty' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('deleteCategory removes empty category', async () => {
    mockLoadTables([makeCategoryRow()], []);
    await service.load(true);

    const delEq = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendation_categories') {
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: delEq }) }),
          select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await service.deleteCategory(CAT_ID);
    expect(result).toEqual({ ok: true });
    expect(delEq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
  });

  it('reorderCategories applies order via atomic RPC then reloads', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    mockLoadTables(
      [
        makeCategoryRow({ id: 'b', display_order: 0 }),
        makeCategoryRow({ id: 'a', display_order: 1 }),
      ],
      []
    );

    const ok = await service.reorderCategories(['b', 'a']);
    expect(ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      'reorder_memorization_recommendation_categories',
      { p_ordered_ids: ['b', 'a'] }
    );
  });

  it('groupedSnapshot clones items so UI mutations do not touch service cache', async () => {
    mockLoadTables(
      [makeCategoryRow()],
      [makeRow({ id: 'rec-1', category_id: CAT_ID })]
    );
    await service.load(true);

    const groupItem = service.groupedSnapshot[0].items[0];
    groupItem.categoryId = 'mutated';
    expect(service.snapshot[0].categoryId).toBe(CAT_ID);
  });

  it('persistVersePlacements applies placements via atomic RPC then reloads', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    mockLoadTables(
      [
        makeCategoryRow(),
        makeCategoryRow({ id: 'cat-2', name: 'Comfort', display_order: 1 }),
      ],
      [makeRow({ id: 'rec-1', category_id: 'cat-2', display_order: 0 })]
    );

    const ok = await service.persistVersePlacements([
      { id: 'rec-1', categoryId: 'cat-2', displayOrder: 0 },
    ]);
    expect(ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      'apply_memorization_recommendation_placements',
      {
        p_placements: [
          {
            id: 'rec-1',
            category_id: 'cat-2',
            display_order: 0,
          },
        ],
      }
    );
    expect(service.snapshot[0].categoryId).toBe('cat-2');
  });

  it('persistVersePlacements keeps local placement when reload fails after RPC success', async () => {
    mockLoadTables(
      [makeCategoryRow(), makeCategoryRow({ id: 'cat-2', name: 'Comfort', display_order: 1 })],
      [makeRow({ id: 'rec-1', category_id: CAT_ID, display_order: 0 })]
    );
    await service.load(true);

    rpcMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'network' },
          })
        }),
      }),
    }));

    const ok = await service.persistVersePlacements([
      { id: 'rec-1', categoryId: 'cat-2', displayOrder: 0 },
    ]);
    expect(ok).toBe(true);
    expect(service.snapshot[0].categoryId).toBe('cat-2');
    expect(service.groupedSnapshot.find((g) => g.category.id === 'cat-2')?.items).toHaveLength(
      1
    );
  });

  it('reorder updates display_order for each verse id via RPC', async () => {
    mockLoadTables(
      [makeCategoryRow()],
      [
        makeRow({ id: 'a', display_order: 0 }),
        makeRow({ id: 'b', display_order: 1 }),
      ]
    );
    await service.load(true);

    rpcMock.mockResolvedValue({ data: null, error: null });
    mockLoadTables(
      [makeCategoryRow()],
      [
        makeRow({ id: 'b', display_order: 0 }),
        makeRow({ id: 'a', display_order: 1 }),
      ]
    );

    const ok = await service.reorder(['b', 'a']);
    expect(ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      'apply_memorization_recommendation_placements',
      {
        p_placements: [
          { id: 'b', category_id: CAT_ID, display_order: 0 },
          { id: 'a', category_id: CAT_ID, display_order: 1 },
        ],
      }
    );
  });

  it('removeRecommendation deletes by id', async () => {
    const delEq = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendations') {
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: delEq }) }),
          select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [makeCategoryRow()], error: null }),
          }),
        }),
      };
    });

    const ok = await service.removeRecommendation('rec-1');
    expect(ok).toBe(true);
    expect(delEq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
  });

  it('getIbcdCatalogStatus returns mapped status from RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        applied: true,
        ibcd_category_count: 30,
        ibcd_verse_count: 104,
      },
      error: null,
    });

    const status = await service.getIbcdCatalogStatus();
    expect(status).toEqual({
      applied: true,
      ibcdCategoryCount: 30,
      ibcdVerseCount: 104,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_memorization_ibcd_catalog_status', {
      p_tenant_id: TENANT_ID,
    });
  });

  it('getIbcdCatalogStatus returns null without active tenant', async () => {
    const tenantContext = {
      getActiveTenant: vi.fn(() => null),
      activeTenant$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    };
    const localService = new MemorizationRecommendationsService(
      { client: { from: fromMock, rpc: rpcMock } } as any,
      cache as any,
      tenantContext as any
    );

    const status = await localService.getIbcdCatalogStatus();
    expect(status).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('applyIbcdCatalog calls RPC and reloads recommendations', async () => {
    mockLoadTables([], []);
    rpcMock.mockResolvedValue({
      data: { applied: true, categories_added: 30, verses_added: 104 },
      error: null,
    });

    const result = await service.applyIbcdCatalog();
    expect(result).toEqual({ ok: true, categoriesAdded: 30, versesAdded: 104 });
    expect(rpcMock).toHaveBeenCalledWith('apply_ibcd_memorization_recommendations', {
      p_tenant_id: TENANT_ID,
    });
    expect(cache.invalidate).toHaveBeenCalled();
  });

  it('applyIbcdCatalog maps not authorized to not_admin', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized for tenant' },
    });

    const result = await service.applyIbcdCatalog();
    expect(result).toEqual({ ok: false, reason: 'not_admin' });
  });

  it('removeIbcdCatalog calls RPC and reloads recommendations', async () => {
    mockLoadTables([], []);
    rpcMock.mockResolvedValue({
      data: { removed_categories: 30, removed_verses: 104 },
      error: null,
    });

    const result = await service.removeIbcdCatalog();
    expect(result).toEqual({
      ok: true,
      removedCategories: 30,
      removedVerses: 104,
    });
    expect(rpcMock).toHaveBeenCalledWith('remove_ibcd_memorization_recommendations', {
      p_tenant_id: TENANT_ID,
    });
    expect(cache.invalidate).toHaveBeenCalled();
  });

  it('hasRecommendations$ reflects whether items exist', async () => {
    const values: boolean[] = [];
    const sub = service.hasRecommendations$.subscribe((v) => values.push(v));

    mockLoadTables([makeCategoryRow()], [makeRow()]);
    await service.load(true);

    expect(values.at(-1)).toBe(true);
    sub.unsubscribe();
  });

  it('load returns cached snapshot without hitting the database', async () => {
    const cachedCategories = [
      {
        id: CAT_ID,
        tenantId: TENANT_ID,
        name: 'Cached',
        displayOrder: 0,
        catalogSource: null,
      },
    ];
    const cachedItems = [
      {
        id: 'cached-1',
        tenantId: TENANT_ID,
        reference: 'Psalm 1:1',
        categoryId: CAT_ID,
        displayOrder: 0,
        catalogSource: null,
      },
    ];
    cache.get.mockReturnValue({ categories: cachedCategories, items: cachedItems });

    const groups = await service.load(false);
    expect(groups[0].category.name).toBe('Cached');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('renameCategory updates category name', async () => {
    mockLoadTables([makeCategoryRow()], []);
    await service.load(true);

    const single = vi.fn().mockResolvedValue({
      data: makeCategoryRow({ name: 'Renamed' }),
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'memorization_recommendation_categories') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single }),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue(selectEqOrder([makeCategoryRow({ name: 'Renamed' })])),
        };
      }
      return { select: vi.fn().mockReturnValue(selectEqOrder([])) };
    });

    const result = await service.renameCategory(CAT_ID, 'Renamed');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.category.name).toBe('Renamed');
    }
  });

  it('addCategory returns duplicate on unique violation', async () => {
    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate' },
          }),
        }),
      }),
    });

    const result = await service.addCategory('General');
    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('removeIbcdCatalog maps unauthorized RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized for tenant' },
    });
    const result = await service.removeIbcdCatalog();
    expect(result).toEqual({ ok: false, reason: 'not_admin' });
  });

  it('load clears state when tenant is missing', async () => {
    const tenantContext = {
      getActiveTenant: vi.fn(() => null),
      activeTenant$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    };
    const localService = new MemorizationRecommendationsService(
      { client: { from: fromMock, rpc: rpcMock } } as any,
      cache as any,
      tenantContext as any
    );
    await expect(localService.load(true)).resolves.toEqual([]);
    expect(localService.snapshot).toEqual([]);
  });

  it('reloads when active tenant changes and ignores duplicate emissions', async () => {
    const activeTenant$ = new BehaviorSubject<{ id: string } | null>({ id: TENANT_ID });
    mockLoadTables([makeCategoryRow()], [makeRow()]);
    const localService = new MemorizationRecommendationsService(
      { client: { from: fromMock, rpc: rpcMock } } as any,
      cache as any,
      {
        getActiveTenant: vi.fn(() => activeTenant$.value),
        activeTenant$,
      } as any
    );
    await vi.waitFor(() => expect(localService.snapshot.length).toBeGreaterThan(0));
    fromMock.mockClear();
    activeTenant$.next({ id: TENANT_ID });
    expect(fromMock).not.toHaveBeenCalled();
    mockLoadTables([makeCategoryRow()], [makeRow({ id: 't2' })]);
    activeTenant$.next({ id: 'tenant-2' });
    await vi.waitFor(() => {
      expect(fromMock).toHaveBeenCalled();
    });
  });

  it('guards empty inputs and no-tenant paths for category/verse mutations', async () => {
    expect(await service.addCategory('  ')).toEqual({ ok: false, reason: 'empty_name' });
    expect(await service.renameCategory(CAT_ID, '')).toEqual({
      ok: false,
      reason: 'empty_name',
    });
    expect(await service.reorderCategories([])).toBe(true);
    expect(await service.persistVersePlacements([])).toBe(true);

    const noTenant = new MemorizationRecommendationsService(
      { client: { from: fromMock, rpc: rpcMock } } as any,
      cache as any,
      {
        getActiveTenant: vi.fn(() => null),
        activeTenant$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
      } as any
    );
    expect(await noTenant.addCategory('X')).toEqual({ ok: false, reason: 'no_tenant' });
    expect(await noTenant.renameCategory(CAT_ID, 'X')).toEqual({
      ok: false,
      reason: 'no_tenant',
    });
    expect(await noTenant.deleteCategory(CAT_ID)).toEqual({ ok: false, reason: 'db_error' });
    expect(await noTenant.addRecommendation('John 3:16', CAT_ID)).toEqual({
      ok: false,
      reason: 'no_tenant',
    });
    expect(await noTenant.removeRecommendation('rec-1')).toBe(false);
    expect(await noTenant.applyIbcdCatalog()).toEqual({ ok: false, reason: 'no_tenant' });
    expect(await noTenant.removeIbcdCatalog()).toEqual({ ok: false, reason: 'no_tenant' });
  });

  it('returns db_error for category/verse failures and reorder unknown ids', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'XX', message: 'fail' },
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '23505', message: 'dup' },
              }),
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { code: '23503', message: 'fk' } }),
        }),
      }),
    });
    expect(await service.addCategory('X')).toEqual({ ok: false, reason: 'db_error' });
    expect(await service.renameCategory(CAT_ID, 'X')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(await service.deleteCategory(CAT_ID)).toEqual({ ok: false, reason: 'not_empty' });
    expect(await service.addRecommendation('John 3:16', CAT_ID)).toEqual({
      ok: false,
      reason: 'db_error',
    });
    expect(await service.removeRecommendation('rec-1')).toBe(false);
    expect(await service.reorder(['missing-id'])).toBe(false);

    rpcMock.mockResolvedValue({ data: null, error: { message: 'rpc fail' } });
    expect(await service.reorderCategories([CAT_ID])).toBe(false);
    expect(await service.persistVersePlacements([
      { id: 'rec-1', categoryId: CAT_ID, displayOrder: 0 },
    ])).toBe(false);
    expect(await service.getIbcdCatalogStatus()).toBeNull();
    expect(await service.applyIbcdCatalog()).toEqual({ ok: false, reason: 'db_error' });
    expect(await service.removeIbcdCatalog()).toEqual({ ok: false, reason: 'db_error' });
    errSpy.mockRestore();
  });
});
