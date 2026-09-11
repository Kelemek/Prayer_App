import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChurchCheckoutService } from './church-checkout.service';

describe('ChurchCheckoutService', () => {
  const getSession = vi.fn();
  const getSupabaseUrl = vi.fn(() => 'https://example.supabase.co');
  const getPublishableKey = vi.fn(() => 'pk_test');

  beforeEach(() => {
    vi.restoreAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  });

  it('starts billing portal with tenant id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/session' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ChurchCheckoutService({
      client: { auth: { getSession } },
      getSupabaseUrl,
      getPublishableKey,
    } as never);

    const url = await service.startBillingPortal('tenant-1', 'my-church');
    expect(url).toBe('https://billing.stripe.com/session');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/stripe-billing-portal',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
