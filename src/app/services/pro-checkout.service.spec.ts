import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProCheckoutService } from './pro-checkout.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

import { Capacitor } from '@capacitor/core';

describe('ProCheckoutService', () => {
  const getSession = vi.fn();
  const getSupabaseUrl = vi.fn(() => 'https://example.supabase.co');
  const getPublishableKey = vi.fn(() => 'pk_test');

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  });

  function service(): ProCheckoutService {
    return new ProCheckoutService({
      client: { auth: { getSession } },
      getSupabaseUrl,
      getPublishableKey,
    } as never);
  }

  it('starts pro checkout on web', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/pro' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await service().startProCheckout()).toBe('https://checkout.stripe.com/pro');
  });

  it('does not start pro checkout on native', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await service().startProCheckout()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when session is missing', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await service().startProCheckout()).toBeNull();
    expect(await service().startBillingPortal()).toBeNull();
  });

  it('returns null when checkout API fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'stripe down' }),
      })
    );
    expect(await service().startProCheckout()).toBeNull();
    errSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('starts pro billing portal with kind pro on web and native', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/session' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await service().startBillingPortal()).toBe('https://billing.stripe.com/session');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/stripe-billing-portal',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"kind":"pro"'),
      })
    );
  });
});
