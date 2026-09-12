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
});
