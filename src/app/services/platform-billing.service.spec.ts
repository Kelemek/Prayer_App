import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformBillingService } from './platform-billing.service';
import type { SupabaseService } from './supabase.service';

describe('PlatformBillingService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: PlatformBillingService;

  beforeEach(() => {
    rpc = vi.fn();
    service = new PlatformBillingService({
      client: { rpc },
    } as unknown as SupabaseService);
  });

  it('loadGraceDays returns configured days', async () => {
    rpc.mockResolvedValue({
      data: { church_past_due_grace_days: 14 },
      error: null,
    });
    await expect(service.loadGraceDays()).resolves.toBe(14);
  });

  it('loadGraceDays defaults to 7 on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.loadGraceDays()).resolves.toBe(7);
  });

  it('saveGraceDays throws on rpc error', async () => {
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    await expect(service.saveGraceDays(3)).rejects.toThrow('nope');
  });

  it('listTenantBilling returns rows', async () => {
    rpc.mockResolvedValue({ data: [{ id: 't1' }], error: null });
    await expect(service.listTenantBilling()).resolves.toEqual([{ id: 't1' }]);
  });
});
