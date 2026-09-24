import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformPlanService } from './platform-plan.service';
import type { SupabaseService } from './supabase.service';

describe('PlatformPlanService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: PlatformPlanService;

  beforeEach(() => {
    rpc = vi.fn();
    service = new PlatformPlanService({
      client: { rpc },
    } as unknown as SupabaseService);
  });

  it('loadSettings returns rpc data', async () => {
    rpc.mockResolvedValue({ data: { tiers: [] }, error: null });
    await expect(service.loadSettings()).resolves.toEqual({ tiers: [] });
  });

  it('loadSettings returns null on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(service.loadSettings()).resolves.toBeNull();
  });

  it('saveGroupLimits returns false on rpc error', async () => {
    rpc.mockResolvedValue({ error: { message: 'fail' } });
    await expect(service.saveGroupLimits('pro', 2, 10)).resolves.toBe(false);
  });

  it('savePracticeModes returns true on success', async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(service.savePracticeModes('free', { type: true })).resolves.toBe(true);
  });
});
