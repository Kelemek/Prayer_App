import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  beforeEach(() => {
    authIdentity = {
      getEmail: vi.fn().mockResolvedValue('user@example.com')
    };

    supabase = {
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

    service = new TenantContextService(supabase, authIdentity);
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
});
