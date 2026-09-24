import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChurchCheckoutService } from './church-checkout.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock('@capacitor/browser', () => ({
  Browser: { open: vi.fn() },
}));

import { Capacitor } from '@capacitor/core';

describe('ChurchCheckoutService', () => {
  const getSession = vi.fn();
  const getSupabaseUrl = vi.fn(() => 'https://example.supabase.co');
  const getPublishableKey = vi.fn(() => 'pk_test');

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  });

  function service(): ChurchCheckoutService {
    return new ChurchCheckoutService({
      client: { auth: { getSession } },
      getSupabaseUrl,
      getPublishableKey,
    } as never);
  }

  it('starts billing portal with tenant id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/session' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const url = await service().startBillingPortal('tenant-1', 'my-church');
    expect(url).toBe('https://billing.stripe.com/session');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/stripe-billing-portal',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('starts user-scoped church checkout without tenant_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/cs' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const url = await service().startChurchCheckout();
    expect(url).toBe('https://checkout.stripe.com/cs');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.tenant_id).toBeUndefined();
  });

  it('does not start church checkout on native', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await service().startChurchCheckout()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports native stripe checkout UI', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(service().isNativeStripeCheckoutUi()).toBe(true);
  });

  it('returns null when session token is missing', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await service().startChurchCheckout()).toBeNull();
    expect(await service().startBillingPortal('tenant-1')).toBeNull();
  });

  it('returns setup_pending when checkout responds with 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ code: 'setup_pending' }),
      })
    );
    expect(await service().startChurchCheckout('tenant-1', 'slug')).toBe(
      'setup_pending'
    );
  });

  it('returns null when checkout HTTP fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'stripe down' }),
      })
    );
    expect(await service().startChurchCheckout()).toBeNull();
    errSpy.mockRestore();
  });

  it('includes tenant return origin when slug is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/cs' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await service().startChurchCheckout('tenant-1', 'my-church');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.tenant_id).toBe('tenant-1');
    expect(body.return_origin).toBeTruthy();
  });

  it('returns null when billing portal HTTP fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'portal fail' }),
      })
    );
    expect(await service().startBillingPortal('tenant-1')).toBeNull();
    errSpy.mockRestore();
  });
});
