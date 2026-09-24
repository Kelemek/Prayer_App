import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPersonalCategoryOrchestrationDeps,
  createPersonalCategoryDeps,
  ensurePersonalCategoryForTenant,
} from './prayer-personal-category-wire';

vi.mock('./prayer-personal-db', () => ({
  queryMaxDisplayOrderForCategoryId: vi.fn(),
  rpcEnsurePersonalCategory: vi.fn(),
}));

import {
  queryMaxDisplayOrderForCategoryId,
  rpcEnsurePersonalCategory,
} from './prayer-personal-db';

describe('prayer-personal-category-wire', () => {
  const client = { rpc: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createPersonalCategoryDeps queries max order when email is present', async () => {
    vi.mocked(queryMaxDisplayOrderForCategoryId).mockResolvedValue({
      data: { display_order: 2 },
      error: null,
    });
    const deps = createPersonalCategoryDeps(
      {
        client: client as never,
        getUserEmail: async () => 'u@example.com',
        getTenantId: () => 'tenant-1',
      },
      vi.fn()
    );
    const result = await deps.queryMaxDisplayOrder('cat-1');
    expect(result.data?.display_order).toBe(2);
    expect(queryMaxDisplayOrderForCategoryId).toHaveBeenCalledWith(
      client,
      'u@example.com',
      'cat-1',
      'tenant-1'
    );
  });

  it('createPersonalCategoryDeps returns error without user email', async () => {
    const deps = createPersonalCategoryDeps(
      {
        client: client as never,
        getUserEmail: async () => null,
      },
      vi.fn()
    );
    const result = await deps.queryMaxDisplayOrder(null);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('ensurePersonalCategoryForTenant requires tenant and RPC data', async () => {
    await expect(
      ensurePersonalCategoryForTenant(
        { client: client as never, getUserEmail: async () => 'u@x.com' },
        'Health'
      )
    ).rejects.toThrow('No active organization selected');

    vi.mocked(rpcEnsurePersonalCategory).mockResolvedValue({
      data: 'cat-id',
      error: null,
    });
    const id = await ensurePersonalCategoryForTenant(
      {
        client: client as never,
        getUserEmail: async () => 'u@x.com',
        getTenantId: () => 'tenant-1',
      },
      'Health'
    );
    expect(id).toBe('cat-id');
  });

  it('buildPersonalCategoryOrchestrationDeps wires local state and RPC', async () => {
    const prayers = [{ id: 'p1' } as never];
    const categories = [{ id: 'c1', name: 'Health' } as never];
    const setPrayers = vi.fn();
    const setCategories = vi.fn();
    client.rpc.mockResolvedValue({ data: null, error: null });

    const deps = buildPersonalCategoryOrchestrationDeps({
      queryDeps: {
        client: client as never,
        getUserEmail: async () => 'u@x.com',
        getTenantId: () => 't1',
      },
      getUserEmail: async () => 'u@x.com',
      getPrayers: () => prayers,
      setPrayers,
      getCategories: () => categories,
      setCategories,
    });

    expect(deps.getTenantId?.()).toBe('t1');
    expect(deps.local.getPrayers()).toBe(prayers);
    await deps.runPrayerOrderRpc({ p_ids: ['p1'] });
    expect(client.rpc).toHaveBeenCalledWith('reorder_personal_prayers', {
      p_ids: ['p1'],
    });
    deps.local.setPrayers([{ id: 'p2' } as never]);
    expect(setPrayers).toHaveBeenCalled();
  });
});
