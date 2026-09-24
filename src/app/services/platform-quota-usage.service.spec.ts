import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformQuotaUsageService } from './platform-quota-usage.service';
import type { SupabaseService } from './supabase.service';

describe('PlatformQuotaUsageService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: PlatformQuotaUsageService;

  beforeEach(() => {
    rpc = vi.fn();
    service = new PlatformQuotaUsageService({
      client: { rpc },
    } as unknown as SupabaseService);
  });

  it('loadSnapshot normalizes payload', async () => {
    rpc.mockResolvedValue({
      data: { users: [{ id: 'u1' }], tenants: [] },
      error: null,
    });
    await expect(service.loadSnapshot()).resolves.toEqual({
      users: [{ id: 'u1' }],
      tenants: [],
    });
  });

  it('loadSnapshot returns null when rpc is missing', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Could not find the function public.list_platform_quota_usage_for_super_admin' },
    });
    await expect(service.loadSnapshot()).resolves.toBeNull();
  });

  it('loadSnapshot throws on unexpected errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(service.loadSnapshot()).rejects.toThrow('permission denied');
  });
});
