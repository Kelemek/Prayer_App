import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { ClientVersionGateService } from './client-version-gate.service';
import { APP_BUNDLE_VERSION } from '../../lib/app-analytics-context';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('ClientVersionGateService', () => {
  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  afterEach(() => {
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

  it('blocks web when the bundle is below min_web_build', async () => {
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
  });

  it('blocks native against min_native_version', async () => {
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

  it('honors an explicit previewBlocked option without calling the RPC', async () => {
    const service = createService();
    await service.initialize({ previewBlocked: true });
    expect(service.isBlocked()).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
