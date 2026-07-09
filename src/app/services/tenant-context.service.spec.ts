import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TenantContextService } from './tenant-context.service';

const tenantA = {
  id: 'tenant-a',
  name: 'Alpha Church',
  slug: 'alpha',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const
};
const tenantB = {
  id: 'tenant-b',
  name: 'Beta Church',
  slug: 'beta',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const
};

describe('TenantContextService', () => {
  let service: TenantContextService;
  let supabase: any;
  let authIdentity: any;
  let connectivity: any;

  beforeEach(() => {
    localStorage.clear();
    authIdentity = {
      getEmail: vi.fn().mockResolvedValue('user@example.com')
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
            data: { session: { user: { email: 'user@example.com' } } }
          }),
          onAuthStateChange: vi.fn()
        },
        from: vi.fn(),
        rpc: vi.fn()
      }
    };

    service = new TenantContextService(supabase, authIdentity, connectivity);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('includes membership tenants in switcher options for regular users', async () => {
    supabase.client.from.mockImplementation((table: string) => {
      if (table === 'tenant_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  tenant_id: tenantA.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantA
                },
                {
                  tenant_id: tenantB.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantB
                }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'global_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    await service.refresh();

    expect(service.getTenantSwitcherOptions()).toHaveLength(2);
    expect(service.getTenantSwitcherOptions().map((t) => t.id)).toEqual(['tenant-a', 'tenant-b']);
  });

  it('deduplicates membership tenants when multiple rows reference the same tenant', async () => {
    supabase.client.from.mockImplementation((table: string) => {
      if (table === 'tenant_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  tenant_id: tenantA.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantA
                },
                {
                  tenant_id: tenantA.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantA
                },
                {
                  tenant_id: tenantB.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantB
                }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'global_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    await service.refresh();

    expect(service.getAccessibleTenants()).toHaveLength(2);
  });


  it('restores tenant snapshot when offline', async () => {
    connectivity.isOnline.mockReturnValue(true);
    supabase.client.from.mockImplementation((table: string) => {
      if (table === 'tenant_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  tenant_id: tenantA.id,
                  user_email: 'user@example.com',
                  role: 'member',
                  tenants: tenantA
                }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'global_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      };
    });

    await service.refresh();
    expect(service.getActiveTenant()?.id).toBe(tenantA.id);
    expect(localStorage.getItem('tenant_context_snapshot')).toBeTruthy();

    connectivity.isOnline.mockReturnValue(false);
    supabase.client.from.mockClear();
    await service.refresh();

    expect(service.getActiveTenant()?.id).toBe(tenantA.id);
    expect(supabase.client.from).not.toHaveBeenCalled();
  });
});
