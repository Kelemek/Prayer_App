import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invokeWipeChurchTenant, navigateAfterChurchWipe } from './admin-wipe-church-run';

vi.mock('./app-origin', () => ({
  getPlatformOrigin: vi.fn(() => 'https://platform.test'),
}));

vi.mock('./tenant-host', () => ({
  parseHost: vi.fn(() => ({ kind: 'tenant', slug: 'my-church' })),
  isTenantSlugHost: vi.fn((parsed: { kind: string }) => parsed.kind === 'tenant'),
}));

vi.mock('../../environments/environment', () => ({
  environment: { platformHosts: [], tenantHostSuffix: 'prayerapp.test' },
}));
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

  it('surfaces invoke transport errors', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new Error('network'),
      response: new Response(null, { status: 500 }),
    });
    const supabase = {
      client: { functions: { invoke } },
    } as unknown as SupabaseService;

    const result = await invokeWipeChurchTenant(supabase, 'tenant-1', 'slug');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
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

  it('navigateAfterChurchWipe redirects when host matches wiped slug', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { hostname: 'my-church.prayerapp.test', protocol: 'https:', assign },
    });
    const tenantContext = { refresh: vi.fn() };
    const router = { navigate: vi.fn() };

    await navigateAfterChurchWipe('my-church', tenantContext as never, router as never);

    expect(assign).toHaveBeenCalledWith('https://platform.test/');
    expect(router.navigate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('navigateAfterChurchWipe refreshes tenant on platform host', async () => {
    const tenantContext = { refresh: vi.fn().mockResolvedValue(undefined) };
    const router = { navigate: vi.fn().mockResolvedValue(true) };

    await navigateAfterChurchWipe('other-church', tenantContext as never, router as never);

    expect(tenantContext.refresh).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
