import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { PersonalCategoryColorService } from './personal-category-color.service';

const TEST_TENANT_ID = 'tenant-abc-123';

describe('PersonalCategoryColorService', () => {
  let service: PersonalCategoryColorService;
  let upsertMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let fromMock: ReturnType<typeof vi.fn>;
  let cache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    invalidateCategory: ReturnType<typeof vi.fn>;
  };
  let userSessionSubject: BehaviorSubject<{ email: string } | null>;
  let activeTenantSubject: BehaviorSubject<{ id: string } | null>;
  let userSessionService: {
    getUserEmail: ReturnType<typeof vi.fn>;
    userSession$: ReturnType<BehaviorSubject<{ email: string } | null>['asObservable']>;
  };
  let tenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: ReturnType<BehaviorSubject<{ id: string } | null>['asObservable']>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    upsertMock = vi.fn().mockResolvedValue({ error: null });
    eqMock = vi.fn().mockResolvedValue({
      data: [{ category: 'Health', color: '#DC2626' }],
      error: null,
    });
    selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    fromMock = vi.fn().mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    });

    cache = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      invalidate: vi.fn(),
      invalidateCategory: vi.fn(),
    };

    userSessionSubject = new BehaviorSubject<{ email: string } | null>({
      email: 'user@example.com',
    });
    activeTenantSubject = new BehaviorSubject<{ id: string } | null>({
      id: TEST_TENANT_ID,
    });

    userSessionService = {
      getUserEmail: vi.fn().mockImplementation(() => userSessionSubject.value?.email ?? null),
      userSession$: userSessionSubject.asObservable(),
    };

    tenantContext = {
      getActiveTenant: vi.fn().mockImplementation(() => activeTenantSubject.value),
      activeTenant$: activeTenantSubject.asObservable(),
    };

    toast = { error: vi.fn() };

    const supabase = {
      client: { from: fromMock },
    };

    service = new PersonalCategoryColorService(
      supabase as any,
      cache as any,
      userSessionService as any,
      tenantContext as any,
      toast as any
    );
  });

  it('loads colors into tenant-scoped cache and snapshot', async () => {
    const map = await service.loadColors(true);
    expect(map.Health).toBe('#DC2626');
    expect(eqMock).toHaveBeenCalledWith('tenant_id', TEST_TENANT_ID);
    expect(cache.set).toHaveBeenCalledWith(
      `personalCategoryColors_${TEST_TENANT_ID}`,
      map
    );
    expect(service.getColorsSnapshot().Health).toBe('#DC2626');
  });

  it('renameCategory updates tenant-scoped snapshot and cache', async () => {
    await service.loadColors(true);
    const updateEqCategory = vi.fn().mockResolvedValue({ error: null });
    const updateEqEmail = vi.fn().mockReturnValue({ eq: updateEqCategory });
    const updateEqTenant = vi.fn().mockReturnValue({ eq: updateEqEmail });
    fromMock.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
      update: vi.fn().mockReturnValue({ eq: updateEqTenant }),
    });

    const result = await service.renameCategory('Health', 'Family');

    expect(result).toBe(true);
    expect(updateEqTenant).toHaveBeenCalledWith('tenant_id', TEST_TENANT_ID);
    expect(service.getColorsSnapshot().Family).toBe('#DC2626');
    expect(service.getColorsSnapshot().Health).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      `personalCategoryColors_${TEST_TENANT_ID}`,
      expect.objectContaining({ Family: '#DC2626' })
    );
  });

  it('deleteCategory removes tenant-scoped snapshot and cache', async () => {
    await service.loadColors(true);
    const deleteEqCategory = vi.fn().mockResolvedValue({ error: null });
    const deleteEqEmail = vi.fn().mockReturnValue({ eq: deleteEqCategory });
    const deleteEqTenant = vi.fn().mockReturnValue({ eq: deleteEqEmail });
    fromMock.mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
      delete: vi.fn().mockReturnValue({ eq: deleteEqTenant }),
    });

    const result = await service.deleteCategory('Health');

    expect(result).toBe(true);
    expect(deleteEqTenant).toHaveBeenCalledWith('tenant_id', TEST_TENANT_ID);
    expect(service.getColorsSnapshot().Health).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      `personalCategoryColors_${TEST_TENANT_ID}`,
      {}
    );
  });

  it('setColor upserts with tenant_id and updates snapshot', async () => {
    await service.setColor('Family', '#2563EB');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TEST_TENANT_ID,
        user_email: 'user@example.com',
        category: 'Family',
        color: '#2563EB',
      }),
      { onConflict: 'tenant_id,user_email,category' }
    );
    expect(service.getColorsSnapshot().Family).toBe('#2563EB');
  });

  it('ignores stale setColor cache updates after the session email changes', async () => {
    service.invalidate();
    cache.set.mockClear();

    let releaseUpsert: (() => void) | undefined;
    const upsertPromise = new Promise<{ error: null }>((resolve) => {
      releaseUpsert = () => resolve({ error: null });
    });
    upsertMock.mockReturnValue(upsertPromise);

    userSessionService.getUserEmail
      .mockReturnValueOnce('user@example.com')
      .mockReturnValueOnce('other@example.com');

    const setPromise = service.setColor('Family', '#2563EB');
    releaseUpsert?.();
    const result = await setPromise;

    expect(result).toBe(true);
    expect(cache.set).not.toHaveBeenCalled();
    expect(service.getColorsSnapshot().Family).toBeUndefined();
  });

  it('invalidate clears snapshot and tenant cache keys', () => {
    service.invalidate();
    expect(service.getColorsSnapshot()).toEqual({});
    expect(cache.invalidateCategory).toHaveBeenCalledWith('personalCategoryColors_');
  });

  it('ignores stale loadColors results after the session email changes', async () => {
    service.invalidate();
    cache.set.mockClear();

    let releaseQuery: (() => void) | undefined;
    const queryPromise = new Promise<{ data: unknown[]; error: null }>((resolve) => {
      releaseQuery = () =>
        resolve({ data: [{ category: 'Health', color: '#DC2626' }], error: null });
    });
    eqMock.mockReturnValue(queryPromise);

    userSessionService.getUserEmail
      .mockReturnValueOnce('user@example.com')
      .mockReturnValueOnce('other@example.com');

    const loadPromise = service.loadColors(true);
    releaseQuery?.();
    await loadPromise;

    expect(cache.set).not.toHaveBeenCalled();
    expect(service.getColorsSnapshot()).toEqual({});
  });

  it('invalidates cached colors when userSession$ emits a new email', () => {
    cache.invalidateCategory.mockClear();
    userSessionSubject.next({ email: 'other@example.com' });
    expect(cache.invalidateCategory).toHaveBeenCalledWith('personalCategoryColors_');
    expect(service.getColorsSnapshot()).toEqual({});
  });

  it('invalidates and reloads when active tenant changes', async () => {
    cache.invalidateCategory.mockClear();
    activeTenantSubject.next({ id: 'tenant-other' });
    expect(cache.invalidateCategory).toHaveBeenCalledWith('personalCategoryColors_');
    expect(service.getColorsSnapshot()).toEqual({});
  });
});
