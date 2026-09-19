import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invokeWipeChurchTenant } from './admin-wipe-church-run';
import type { SupabaseService } from '../services/supabase.service';

describe('invokeWipeChurchTenant', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    invoke.mockReset();
  });

  it('returns success when edge function succeeds', async () => {
    invoke.mockResolvedValue({
      data: { success: true, ops: ['db:wiped'] },
      error: null,
      response: new Response(null, { status: 200 }),
    });
    const supabase = {
      client: { functions: { invoke } },
    } as unknown as SupabaseService;

    const result = await invokeWipeChurchTenant(supabase, 'tenant-1', 'my-church');

    expect(invoke).toHaveBeenCalledWith('wipe-church-tenant', {
      body: { tenant_id: 'tenant-1', confirm_slug: 'my-church' },
    });
    expect(result.success).toBe(true);
    expect(result.ops).toEqual(['db:wiped']);
  });

  it('surfaces server error message', async () => {
    invoke.mockResolvedValue({
      data: { success: false, error: 'Slug confirmation mismatch' },
      error: null,
      response: new Response(null, { status: 400 }),
    });
    const supabase = {
      client: { functions: { invoke } },
    } as unknown as SupabaseService;

    const result = await invokeWipeChurchTenant(supabase, 'tenant-1', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Slug confirmation mismatch');
  });
});
