import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TenantContextService } from './tenant-context.service';

const tenantA = {
  id: 'tenant-a',
  name: 'Alpha Church',
  slug: 'alpha',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const,
};
const tenantB = {
  id: 'tenant-b',
  name: 'Beta Church',
  slug: 'beta',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const,
};

function membershipMocks(supabase: any, opts: {
  memberships?: unknown[];
  membershipsError?: unknown;
  superRole?: unknown;
  roleError?: unknown;
  allTenantsRpc?: { data?: unknown; error?: unknown };
  tenantsTable?: { data?: unknown; error?: unknown };
}) {
  supabase.client.from.mockImplementation((table: string) => {
    if (table === 'tenant_memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: opts.memberships ?? [],
            error: opts.membershipsError ?? null,
          }),
        }),
      };
    }
    if (table === 'global_roles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: opts.superRole ?? null,
                error: opts.roleError ?? null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'tenants') {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: opts.tenantsTable?.data ?? [],
            error: opts.tenantsTable?.error ?? null,
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
  });
  supabase.client.rpc = vi.fn().mockResolvedValue(
    opts.allTenantsRpc ?? { data: [tenantA, tenantB], error: null }
  );
}

describe('TenantContextService', () => {
  let service: TenantContextService;
  let supabase: any;
  let authIdentity: any;
  let connectivity: any;
  let authStateCallback: ((event: string, session: unknown) => void) | null;

  beforeEach(() => {
    localStorage.clear();
    authStateCallback = null;
    authIdentity = {
      getEmail: vi.fn().mockResolvedValue('user@example.com'),
    };
    connectivity = {
      isOnline: vi.fn(() => true),
      requireOnline: vi.fn(() => true),
    };
    supabase = {
      isNetworkError: vi.fn(() => false),
      client: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { email: 'user@example.com' } } },
          }),
          onAuthStateChange: vi.fn((_cb: any) => {
            authStateCallback = _cb;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }),
        },
        from: vi.fn(),
        rpc: vi.fn(),
      },
    };
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
      ],
    });
    service = new TenantContextService(supabase, authIdentity, connectivity);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('exposes getters for memberships and tenants', async () => {
    await service.refresh();
    expect(service.getMemberships().length).toBeGreaterThan(0);
    expect(service.getAvailableTenants().length).toBeGreaterThan(0);
    expect(service.getMemberTenants().map((t) => t.id)).toContain('tenant-a');
    expect(service.getSubscriberTenants()).toEqual(service.getMemberTenants());
    expect(service.getAccessibleTenants()).toEqual(service.getMemberTenants());
    expect(service.getIsSuperAdmin()).toBe(false);
  });

  it('includes membership tenants in switcher options for regular users', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
        {
          tenant_id: tenantB.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantB,
        },
      ],
    });
    await service.refresh();
    expect(service.getTenantSwitcherOptions().map((t) => t.id).sort()).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
  });

  it('deduplicates membership tenants when multiple rows reference the same tenant', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: [tenantA],
        },
        {
          tenant_id: tenantB.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantB,
        },
      ],
    });
    await service.refresh();
    expect(service.getAccessibleTenants()).toHaveLength(2);
  });

  it('restores tenant snapshot when offline', async () => {
    await service.refresh();
    expect(service.getActiveTenant()?.id).toBe(tenantA.id);

    connectivity.isOnline.mockReturnValue(false);
    supabase.client.from.mockClear();
    await service.refresh();
    expect(service.getActiveTenant()?.id).toBe(tenantA.id);
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it('clears context when email is missing', async () => {
    authIdentity.getEmail.mockResolvedValue(null);
    await service.refresh();
    expect(service.getActiveTenant()).toBeNull();
    expect(service.getMemberships()).toEqual([]);
  });

  it('warns when offline with no snapshot', async () => {
    localStorage.clear();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    connectivity.isOnline.mockReturnValue(false);
    await service.refresh();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('switchTenant succeeds for accessible tenant and fails otherwise', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
        {
          tenant_id: tenantB.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantB,
        },
      ],
    });
    await service.refresh();
    expect(await service.switchTenant('tenant-b')).toBe(true);
    expect(service.getActiveTenant()?.id).toBe('tenant-b');
    expect(localStorage.getItem('active_tenant_id')).toBe('tenant-b');

    connectivity.isOnline.mockReturnValue(false);
    expect(await service.switchTenant('missing')).toBe(false);
    expect(connectivity.requireOnline).toHaveBeenCalled();
  });

  it('detects impersonation for super admin without membership', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
      ],
      superRole: { role: 'super_admin' },
      allTenantsRpc: { data: [tenantA, tenantB], error: null },
    });
    await service.refresh();
    expect(service.getIsSuperAdmin()).toBe(true);
    await service.switchTenant('tenant-b');
    expect(service.getIsImpersonatingTenant()).toBe(true);
    await service.switchTenant('tenant-a');
    expect(service.getIsImpersonatingTenant()).toBe(false);
  });

  it('falls back to tenants table when super-admin RPC fails', async () => {
    membershipMocks(supabase, {
      memberships: [],
      superRole: { role: 'super_admin' },
      allTenantsRpc: { data: null, error: { message: 'rpc fail' } },
      tenantsTable: { data: [tenantB, tenantA], error: null },
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.refresh();
    expect(service.getAvailableTenants().map((t) => t.id).sort()).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
    err.mockRestore();
  });

  it('uses snapshot on network failure during refresh', async () => {
    await service.refresh();
    supabase.isNetworkError.mockReturnValue(true);
    membershipMocks(supabase, {
      membershipsError: { message: 'fetch failed' },
      memberships: null as any,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await service.refresh();
    expect(service.getActiveTenant()?.id).toBe(tenantA.id);
    warn.mockRestore();
  });

  it('restores minimal active tenant when snapshot missing but id stored', async () => {
    localStorage.clear();
    localStorage.setItem('active_tenant_id', 'stub-1');
    connectivity.isOnline.mockReturnValue(false);
    service = new TenantContextService(supabase, authIdentity, connectivity);
    await service.refresh();
    expect(service.getActiveTenant()?.id).toBe('stub-1');
    expect(service.getAvailableTenants()[0].name).toBe('Offline');
  });

  it('handles auth logout by clearing context', async () => {
    await service.refresh();
    expect(authStateCallback).toBeTruthy();
    authStateCallback?.('SIGNED_OUT', null);
    expect(service.getActiveTenant()).toBeNull();
    expect(localStorage.getItem('active_tenant_id')).toBeNull();
  });

  it('handles memberships error without snapshot by clearing memberships', async () => {
    localStorage.clear();
    membershipMocks(supabase, {
      membershipsError: { message: 'db' },
      memberships: null as any,
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.refresh();
    expect(service.getMemberships()).toEqual([]);
    err.mockRestore();
  });

  it('handles role error by clearing super admin flag', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: tenantA,
        },
      ],
      roleError: { message: 'role fail' },
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.refresh();
    expect(service.getIsSuperAdmin()).toBe(false);
    err.mockRestore();
  });

  it('normalizes empty tenants array on membership to null tenant', async () => {
    membershipMocks(supabase, {
      memberships: [
        {
          tenant_id: tenantA.id,
          user_email: 'user@example.com',
          role: 'member',
          tenants: [],
        },
      ],
    });
    await service.refresh();
    expect(service.getMemberTenants()).toEqual([]);
  });
});
