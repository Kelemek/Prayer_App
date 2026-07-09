import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectivityService } from './connectivity.service';
import { ToastService } from './toast.service';

describe('ConnectivityService', () => {
  let toast: { info: ReturnType<typeof vi.fn> };
  let service: ConnectivityService;

  beforeEach(() => {
    toast = { info: vi.fn() };
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    service = new ConnectivityService(toast as unknown as ToastService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('reports online when navigator.onLine is true', () => {
    expect(service.isOnline()).toBe(true);
  });

  it('requireOnline returns true when online without toasting', () => {
    expect(service.requireOnline('submit a prayer')).toBe(true);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('requireOnline returns false and shows info toast when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    const offlineService = new ConnectivityService(toast as unknown as ToastService);
    expect(offlineService.requireOnline('submit a prayer')).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('You need to be online to submit a prayer.');
    offlineService.ngOnDestroy();
  });

  it('updates when window fires offline/online events', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
  });
});
