import { describe, expect, it, vi, beforeEach } from 'vitest';

const { browserOpen, isNativePlatform } = vi.hoisted(() => ({
  browserOpen: vi.fn(),
  isNativePlatform: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: { open: browserOpen },
}));

import { openBillingUrl } from './open-billing-url';

describe('openBillingUrl', () => {
  beforeEach(() => {
    browserOpen.mockReset();
    isNativePlatform.mockReset();
  });

  it('opens in-app browser on native platforms', async () => {
    isNativePlatform.mockReturnValue(true);
    await openBillingUrl('https://billing.example/session');
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://billing.example/session' });
  });

  it('assigns location on web', async () => {
    isNativePlatform.mockReturnValue(false);
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    await openBillingUrl('https://billing.example/session');
    expect(assign).toHaveBeenCalledWith('https://billing.example/session');
    assign.mockRestore();
  });
});
