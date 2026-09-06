import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { PersonalCategoryColorService } from './personal-category-color.service';

const TEST_TENANT_ID = 'tenant-abc-123';

describe('PersonalCategoryColorService', () => {
  let service: PersonalCategoryColorService;
  let eqMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let fromMock: ReturnType<typeof vi.fn>;
  let rpcMock: ReturnType<typeof vi.fn>;
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
    eqMock = vi.fn().mockResolvedValue({
      data: [{ name: 'Health', color: '#DC2626' }],
      error: null,
    });
    selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    fromMock = vi.fn().mockReturnValue({
      select: selectMock,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    rpcMock = vi.fn().mockResolvedValue({ data: 'cat-family', error: null });

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
      client: { from: fromMock, rpc: rpcMock },
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

    const result = await service.renameCategory('Health', 'Family');

    expect(result).toBe(true);
    expect(service.getColorsSnapshot().Family).toBe('#DC2626');
    expect(service.getColorsSnapshot().Health).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      `personalCategoryColors_${TEST_TENANT_ID}`,
      expect.objectContaining({ Family: '#DC2626' })
    );
  });

  it('deleteCategory removes tenant-scoped snapshot and cache', async () => {
    await service.loadColors(true);

    const result = await service.deleteCategory('Health');

    expect(result).toBe(true);
    expect(service.getColorsSnapshot().Health).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      `personalCategoryColors_${TEST_TENANT_ID}`,
      {}
    );
  });

  it('setColor ensures the category then updates color', async () => {
    await service.setColor('Family', '#2563EB');
    expect(rpcMock).toHaveBeenCalledWith('ensure_personal_category', {
      p_name: 'Family',
      p_tenant_id: TEST_TENANT_ID,
    });
    expect(fromMock).toHaveBeenCalledWith('personal_categories');
    expect(service.getColorsSnapshot().Family).toBe('#2563EB');
  });

  it('ignores stale setColor cache updates after the session email changes', async () => {
    service.invalidate();
    cache.set.mockClear();

    let releaseRpc: (() => void) | undefined;
    const rpcPromise = new Promise<{ data: string; error: null }>((resolve) => {
      releaseRpc = () => resolve({ data: 'cat-family', error: null });
    });
    rpcMock.mockReturnValue(rpcPromise);

    userSessionService.getUserEmail
      .mockReturnValueOnce('user@example.com')
      .mockReturnValueOnce('other@example.com');

    const setPromise = service.setColor('Family', '#2563EB');
    releaseRpc?.();
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
        resolve({ data: [{ name: 'Health', color: '#DC2626' }], error: null });
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
