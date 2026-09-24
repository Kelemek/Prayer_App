import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  AppIconBadgeService,
  createCapawesomeAppIconBadgeNative,
  type AppIconBadgeNativeApi,
} from './app-icon-badge.service';
import { BadgeService } from './badge.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

const capawesomeBadge = vi.hoisted(() => ({
  configure: vi.fn(async () => undefined),
  requestPermissions: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
}));

vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: capawesomeBadge,
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
    window.dispatchEvent(new CustomEvent('app-became-visible'));
    await Promise.resolve();
    await Promise.resolve();
    expect(native.set).not.toHaveBeenCalledWith(0);
    expect('clear' in native).toBe(false);
  });

  it('syncs when badge functionality is toggled', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();
    native.set.mockClear();
    badgeService.getAllTenantDisplayedBadgeCount.mockReturnValue(0);
    badgesEnabled$.next(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(native.set).toHaveBeenCalledWith(0);
  });

  it('logs when native set fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const native = createNativeMock(true);
    native.set = vi.fn().mockRejectedValue(new Error('native fail'));
    service.setNativeApiForTests(native);
    await service.start();
    await service.sync();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('start is idempotent', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();
    native.configure.mockClear();
    await service.start();
    expect(native.configure).not.toHaveBeenCalled();
  });

  it('skips a no-op set when the count has not changed', async () => {
    const native = createNativeMock(true);
    service.setNativeApiForTests(native);
    await service.start();
    native.set.mockClear();
    await service.sync();
    expect(native.set).not.toHaveBeenCalled();
  });

  it('logs when native configure fails during start', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const native = createNativeMock(true);
    native.configure = vi.fn().mockRejectedValue(new Error('configure fail'));
    service.setNativeApiForTests(native);
    await service.start();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('createCapawesomeAppIconBadgeNative', () => {
  it('delegates configure, permissions, and set to Capawesome Badge', async () => {
    capawesomeBadge.configure.mockClear();
    capawesomeBadge.requestPermissions.mockClear();
    capawesomeBadge.set.mockClear();
    const api = createCapawesomeAppIconBadgeNative();
    await api.configure({ persist: true, autoClear: false });
    await api.requestPermissions();
    await api.set(3);
    expect(capawesomeBadge.configure).toHaveBeenCalledWith({
      persist: true,
      autoClear: false,
    });
    expect(capawesomeBadge.requestPermissions).toHaveBeenCalled();
    expect(capawesomeBadge.set).toHaveBeenCalledWith({ count: 3 });
  });
});
