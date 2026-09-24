import { describe, expect, it, vi } from 'vitest';
import {
  deleteCommunityPrayerRow,
  fetchApprovedSharedPrayers,
  fetchApprovedSharedPrayerUpdates,
  fetchCommunityPrayerUpdatesByPrayerIds,
  fetchCommunityPrayersByMonth,
  findTenantMembershipByEmail,
  insertCommunityPrayerRowNoReturning,
  insertTenantMembershipMemberRow,
  updateCommunityPrayerStatusRow,
} from './prayer-community-db';

function queryChain(
  resolved: { data?: unknown; error?: unknown } = { data: [], error: null }
) {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.order = vi.fn().mockResolvedValue(resolved);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.single = vi.fn().mockResolvedValue(resolved);
  chain.insert = vi.fn().mockResolvedValue(resolved);
  return chain;
}

describe('prayer-community-db', () => {
  it('fetchApprovedSharedPrayers returns empty without tenant', async () => {
    const result = await fetchApprovedSharedPrayers({ rpc: vi.fn() } as never, {
      tenantId: null,
      useSuperAdminRpc: false,
      actorEmail: 'a@b.com',
    });
    expect(result.prayersData).toEqual([]);
  });

  it('fetchApprovedSharedPrayers super admin requires actor email', async () => {
    const result = await fetchApprovedSharedPrayers({ rpc: vi.fn() } as never, {
      tenantId: 't1',
      useSuperAdminRpc: true,
      actorEmail: null,
    });
    expect(result.error).toBeInstanceOf(Error);
  });

  it('fetchApprovedSharedPrayers uses super admin RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null });
    const result = await fetchApprovedSharedPrayers({ rpc } as never, {
      tenantId: 't1',
      useSuperAdminRpc: true,
      actorEmail: 'admin@example.com',
    });
    expect(result.prayersData).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('list_approved_prayers_for_super_admin', {
      p_actor_email: 'admin@example.com',
      p_tenant_id: 't1',
    });
  });

  it('fetchApprovedSharedPrayers queries prayers table for members', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'p2' }], error: null });
    const eqStatus = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq: eqStatus });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from, rpc: vi.fn() };

    const result = await fetchApprovedSharedPrayers(client as never, {
      tenantId: 't1',
      useSuperAdminRpc: false,
      actorEmail: 'u@x.com',
    });
    expect(result.prayersData[0]?.id).toBe('p2');
    expect(from).toHaveBeenCalledWith('prayers');
  });

  it('fetchApprovedSharedPrayerUpdates short-circuits empty ids', async () => {
    const result = await fetchApprovedSharedPrayerUpdates({} as never, [], {
      tenantId: 't1',
      useSuperAdminRpc: false,
      actorEmail: 'u@x.com',
    });
    expect(result.updatesData).toEqual([]);
  });

  it('fetchApprovedSharedPrayerUpdates uses super admin RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'u1' }], error: null });
    const result = await fetchApprovedSharedPrayerUpdates(
      { rpc } as never,
      ['p1'],
      { tenantId: 't1', useSuperAdminRpc: true, actorEmail: 'admin@x.com' }
    );
    expect(result.updatesData).toHaveLength(1);
  });

  it('delegates community CRUD helpers to supabase client', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_memberships') {
          return queryChain({ data: { id: 'm1' }, error: null });
        }
        return queryChain({ data: [{ id: 'p1' }], error: null });
      }),
    };

    await insertCommunityPrayerRowNoReturning(client as never, { title: 't' });
    await updateCommunityPrayerStatusRow(client as never, 'p1', { status: 'answered' }, 't1');
    await deleteCommunityPrayerRow(client as never, 'p1', 't1');
    const month = await fetchCommunityPrayersByMonth(
      client as never,
      '2026-01-01',
      '2026-02-01',
      't1'
    );
    expect(month.data).toHaveLength(1);

    const membership = await findTenantMembershipByEmail(
      client as never,
      't1',
      'u@x.com'
    );
    expect(membership.data?.id).toBe('m1');

    await insertTenantMembershipMemberRow(client as never, {
      name: 'User',
      user_email: 'u@x.com',
      tenant_id: 't1',
    });
    expect(client.from).toHaveBeenCalled();
  });

  it('fetchCommunityPrayerUpdatesByPrayerIds queries updates', async () => {
    const client = {
      from: vi.fn(() => queryChain({ data: [{ id: 'u1' }], error: null })),
    };
    const result = await fetchCommunityPrayerUpdatesByPrayerIds(
      client as never,
      ['p1'],
      't1'
    );
    expect(result.data).toHaveLength(1);
  });
});
