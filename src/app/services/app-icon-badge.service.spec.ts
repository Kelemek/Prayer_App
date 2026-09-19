import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppIconBadgeService, type AppIconBadgeNativeApi } from './app-icon-badge.service';
import { BadgeService } from './badge.service';
import { TenantContextService } from './tenant-context.service';
import { UserSessionService } from './user-session.service';
import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

function createNativeMock(isNative = true): AppIconBadgeNativeApi {
  return {
    isNativePlatform: vi.fn(() => isNative),
    configure: vi.fn(async () => undefined),
    requestPermissions: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  };
}

describe('AppIconBadgeService', () => {
  let service: AppIconBadgeService;
  let badgeService: {
    getAllTenantDisplayedBadgeCount: ReturnType<typeof vi.fn>;
    getUpdateBadgesChanged$: ReturnType<typeof vi.fn>;
    getBadgeFunctionalityEnabled$: ReturnType<typeof vi.fn>;
  };
  let tenantContext: {
    memberships$: BehaviorSubject<unknown[]>;
    getMemberTenants: ReturnType<typeof vi.fn>;
    getMemberships: ReturnType<typeof vi.fn>;
    getActiveTenant: ReturnType<typeof vi.fn>;
  };
  let userSession: {
    userSession$: BehaviorSubject<unknown>;
    getUserEmail: ReturnType<typeof vi.fn>;
  };
  let updateBadgesChanged$: Subject<void>;
  let badgesEnabled$: BehaviorSubject<boolean>;

  beforeEach(() => {
    localStorage.clear();
    updateBadgesChanged$ = new Subject<void>();
    badgesEnabled$ = new BehaviorSubject(true);
    badgeService = {
      getAllTenantDisplayedBadgeCount: vi.fn(() => 4),
      getUpdateBadgesChanged$: vi.fn(() => updateBadgesChanged$.asObservable()),
      getBadgeFunctionalityEnabled$: vi.fn(() => badgesEnabled$.asObservable()),
    };
    tenantContext = {
      memberships$: new BehaviorSubject([]),
      getMemberTenants: vi.fn(() => []),
      getMemberships: vi.fn(() => []),
      getActiveTenant: vi.fn(() => ({ id: 'tenant-a' })),
    };
    userSession = {
      userSession$: new BehaviorSubject({ email: 'member@example.com' }),
      getUserEmail: vi.fn(() => 'member@example.com'),
    };

    service = new AppIconBadgeService(
      badgeService as unknown as BadgeService,
      tenantContext as unknown as TenantContextService,
      userSession as unknown as UserSessionService,
      { client: { rpc: vi.fn(), from: vi.fn() } } as unknown as SupabaseService,
      {
        hasData: vi.fn(() => true),
        set: vi.fn(),
      } as unknown as CacheService
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not touch native APIs on web', async () => {
    const native = createNativeMock(false);
    service.setNativeApiForTests(native);
    await service.start();
    await service.sync();
    expect(native.configure).not.toHaveBeenCalled();
    expect(native.set).not.toHaveBeenCalled();
  });

  it('sets the native icon to the all-tenant in-app count', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();

    expect(native.configure).toHaveBeenCalledWith({
      persist: true,
      autoClear: false,
    });
    expect(native.requestPermissions).toHaveBeenCalled();
    expect(native.set).toHaveBeenCalledWith(4);
  });

  it('re-syncs when in-app badges change and does not clear on visibility', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();
    native.set.mockClear();

    badgeService.getAllTenantDisplayedBadgeCount.mockReturnValue(2);
    updateBadgesChanged$.next();
    await Promise.resolve();
    await Promise.resolve();

    expect(native.set).toHaveBeenCalledWith(2);

    native.set.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();
    // App open / resume may re-apply the same count; it must never write 0 as a clear.
    expect(native.set).not.toHaveBeenCalledWith(0);
    expect('clear' in native).toBe(false);
  });

  it('skips a no-op set when the count has not changed', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();
    native.set.mockClear();
    await service.sync();
    expect(native.set).not.toHaveBeenCalled();
  });
});
