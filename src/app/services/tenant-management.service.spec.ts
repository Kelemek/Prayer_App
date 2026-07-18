import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantManagementService } from './tenant-management.service';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let rpc: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let getSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpc = vi.fn();
    refresh = vi.fn(async () => undefined);
    getSession = vi.fn().mockResolvedValue({
      data: { session: { user: { email: 'admin@example.com' }, access_token: 'jwt' } },
    });
    from = vi.fn();
    service = new TenantManagementService(
      {
        client: { auth: { getSession }, rpc, from },
      } as unknown as SupabaseService,
      { refresh } as unknown as TenantContextService
    );
  });

  it('creates tenant and refreshes context', async () => {
    rpc.mockResolvedValue({
      data: { id: 'tenant-1', name: 'Test Church', plan_tier: 'groups' },
      error: null,
    });

    const tenant = await service.createTenant('Test Church', 'test-church');
    expect(tenant.id).toBe('tenant-1');
    expect(rpc).toHaveBeenCalledWith(
      'create_tenant_for_user',
      expect.objectContaining({
        p_name: 'Test Church',
        p_slug: 'test-church',
        p_plan_tier: 'groups',
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('requires login to create tenant', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(service.createTenant('Test', 'test')).rejects.toThrow(
      'You must be logged in to create a tenant'
    );
  });

  it('creates invite with normalized email', async () => {
    rpc.mockResolvedValue({ data: 'invite-token', error: null });
    const token = await service.createInvite('tenant-1', ' Member@Example.com ');
    expect(token).toBe('invite-token');
    expect(rpc).toHaveBeenCalledWith(
      'create_tenant_invite',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_invitee_email: 'member@example.com',
        p_invited_by_email: 'admin@example.com',
      })
    );
  });

  it('claims invite when email matches and invite is pending', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'invite-1',
        tenant_id: 'tenant-1',
        email: 'member@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === 'tenant_invites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      return { insert };
    });
    getSession.mockResolvedValue({
      data: { session: { user: { email: 'member@example.com' } } },
    });

    await service.claimInvite('token-123');
    expect(insert).toHaveBeenCalled();
    expect(updateEq).toHaveBeenCalledWith('id', 'invite-1');
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects invite when email does not match', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'invite-1',
        tenant_id: 'tenant-1',
        email: 'other@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(service.claimInvite('token-123')).rejects.toThrow(
      'Invite email does not match this user'
    );
  });

  it('lists super admins for caller', async () => {
    rpc.mockResolvedValue({
      data: [{ user_email: 'admin@example.com' }],
      error: null,
    });
    await expect(service.listSuperAdmins()).resolves.toEqual([
      { user_email: 'admin@example.com' },
    ]);
  });

  it('updates tenant plan and refreshes context', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await service.setTenantPlan('tenant-1', 'churches', 'active');
    expect(rpc).toHaveBeenCalledWith(
      'update_tenant_subscription',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_plan_tier: 'churches',
        p_status: 'active',
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('assigns and removes super admin roles', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const delEq = vi.fn().mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === 'global_roles') {
        return {
          upsert,
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: delEq }) }),
        };
      }
      return { select: vi.fn() };
    });

    await service.assignSuperAdmin('new-admin@example.com');
    expect(upsert).toHaveBeenCalledWith(
      { user_email: 'new-admin@example.com', role: 'super_admin' },
      { onConflict: 'user_email' }
    );

    await service.removeSuperAdmin('old-admin@example.com');
    expect(delEq).toHaveBeenCalledWith('role', 'super_admin');
  });

  it('returns memberships for active tenant', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ tenant_id: 'tenant-1', user_email: 'member@example.com', role: 'member' }],
      error: null,
    });
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order }),
      }),
    });
  service = new TenantManagementService(
      {
        client: { auth: { getSession }, rpc, from },
      } as unknown as SupabaseService,
      {
        refresh,
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1', name: 'Test' })),
      } as unknown as TenantContextService
    );

    const memberships = await service.getMembershipsForActiveTenant();
    expect(memberships).toHaveLength(1);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('throws when createTenant RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });
    await expect(service.createTenant('Test', 'test')).rejects.toThrow('rpc failed');
  });

  it('requires login to create invite', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(service.createInvite('tenant-1', 'a@b.com')).rejects.toThrow(
      'You must be logged in to invite members'
    );
  });

  it('throws when createInvite RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invite failed' } });
    await expect(service.createInvite('tenant-1', 'a@b.com')).rejects.toThrow('invite failed');
  });

  it('requires login to claim invite', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(service.claimInvite('token')).rejects.toThrow(
      'You must be logged in to claim an invite'
    );
  });

  it('throws when invite is missing', async () => {
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    await expect(service.claimInvite('token')).rejects.toThrow(
      'Invite not found or already used'
    );
  });

  it('throws when invite has expired', async () => {
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'invite-1',
                tenant_id: 'tenant-1',
                email: 'admin@example.com',
                expires_at: new Date(Date.now() - 60_000).toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await expect(service.claimInvite('token')).rejects.toThrow('Invite has expired');
  });

  it('throws when membership insert fails during claim', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'invite-1',
        tenant_id: 'tenant-1',
        email: 'admin@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });
    from.mockImplementation((table: string) => {
      if (table === 'tenant_invites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }) };
    });
    await expect(service.claimInvite('token')).rejects.toThrow('insert failed');
  });

  it('throws when invite update fails during claim', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'invite-1',
        tenant_id: 'tenant-1',
        email: 'admin@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: { message: 'update failed' } });
    from.mockImplementation((table: string) => {
      if (table === 'tenant_invites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    await expect(service.claimInvite('token')).rejects.toThrow('update failed');
  });

  it('throws when setTenantPlan fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'plan failed' } });
    await expect(service.setTenantPlan('tenant-1', 'groups')).rejects.toThrow('plan failed');
  });

  it('getActorEmail returns session email', async () => {
    await expect(service.getActorEmail()).resolves.toBe('admin@example.com');
  });

  it('requires login to list super admins', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(service.listSuperAdmins()).rejects.toThrow('You must be logged in');
  });

  it('throws when listSuperAdmins RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'list failed' } });
    await expect(service.listSuperAdmins()).rejects.toThrow('list failed');
  });

  it('throws when assignSuperAdmin fails', async () => {
    from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } }),
    });
    await expect(service.assignSuperAdmin('a@b.com')).rejects.toThrow('upsert failed');
  });

  it('throws when removeSuperAdmin fails', async () => {
    from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'delete failed' } }),
        }),
      }),
    });
    await expect(service.removeSuperAdmin('a@b.com')).rejects.toThrow('delete failed');
  });

  it('returns empty memberships when no active tenant', async () => {
    service = new TenantManagementService(
      { client: { auth: { getSession }, rpc, from } } as unknown as SupabaseService,
      {
        refresh,
        getActiveTenant: vi.fn(() => null),
      } as unknown as TenantContextService
    );
    await expect(service.getMembershipsForActiveTenant()).resolves.toEqual([]);
  });

  it('throws when memberships query fails', async () => {
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'query failed' } }),
        }),
      }),
    });
    service = new TenantManagementService(
      { client: { auth: { getSession }, rpc, from } } as unknown as SupabaseService,
      {
        refresh,
        getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
      } as unknown as TenantContextService
    );
    await expect(service.getMembershipsForActiveTenant()).rejects.toThrow('query failed');
  });
});
