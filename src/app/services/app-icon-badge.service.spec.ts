import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppIconBadgeService, type AppIconBadgeNativeApi } from './app-icon-badge.service';
import { BadgeService } from './badge.service';

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

    service = new AppIconBadgeService(badgeService as unknown as BadgeService);
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
