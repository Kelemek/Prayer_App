import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { ClientVersionGateService } from './client-version-gate.service';
import { APP_BUNDLE_VERSION } from '../../lib/app-analytics-context';
import { CLIENT_UPGRADE_AUTO_RELOAD_KEY } from '../../lib/client-version-gate';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('ClientVersionGateService', () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn();
    reloadSpy = vi.fn();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        search: '',
        reload: reloadSpy,
      },
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  function createService(): ClientVersionGateService {
    return new ClientVersionGateService({
      client: { rpc: rpcMock },
    } as never);
  }

  it('stays open when mins are unset', async () => {
    rpcMock.mockResolvedValue({
      data: [{ min_web_build: null, min_native_version: null }],
      error: null,
    });
    const service = createService();
    await service.initialize();
    expect(service.isBlocked()).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith('get_public_client_min_versions');
  });

  it('blocks web when the bundle is below min_web_build and auto-reloads once', async () => {
    rpcMock.mockResolvedValue({
      data: [{ min_web_build: '99.0', min_native_version: null }],
      error: null,
    });
    const service = createService();
    await service.initialize();
    expect(service.isBlocked()).toBe(true);
    expect(service.getDecision()).toMatchObject({
      surface: 'web',
      clientVersion: APP_BUNDLE_VERSION,
      minVersion: '99.0',
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CLIENT_UPGRADE_AUTO_RELOAD_KEY)).toBe('1');
  });

  it('blocks native against min_native_version without auto-reload', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    rpcMock.mockResolvedValue({
      data: [{ min_web_build: null, min_native_version: '99.0' }],
      error: null,
    });
    const service = createService();
    await service.initialize();
    expect(service.isBlocked()).toBe(true);
    expect(service.getDecision().surface).toBe('native');
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('fails open when the RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const service = createService();
    await service.initialize();
    expect(service.isBlocked()).toBe(false);
  });

  it('honors a non-production ?force_upgrade=1 preview', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { search: '?force_upgrade=1', reload: reloadSpy },
    });
    const service = createService();
    await service.initialize();
    expect(service.isBlocked()).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
