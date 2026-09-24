import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPersonalCategoryDeleteSnapshot,
  applyPersonalCategoryRenameSnapshot,
  orchestratePersonalCategoryDelete,
  orchestratePersonalCategoryRename,
  orchestratePersonalCategoryReorder,
  orchestratePersonalPrayerOrderUpdate,
} from './prayer-personal-category-orchestrate';
import {
  rpcDeletePersonalCategory,
  rpcRenamePersonalCategory,
  rpcReorderPersonalCategories,
} from './prayer-personal-db';
import { runPersonalPrayerOrderRpcPerCategory } from './prayer-personal-order-rpc';

vi.mock('./prayer-personal-db', () => ({
  rpcReorderPersonalCategories: vi.fn(),
  rpcRenamePersonalCategory: vi.fn(),
  rpcDeletePersonalCategory: vi.fn(),
}));

vi.mock('./prayer-personal-order-rpc', () => ({
  runPersonalPrayerOrderRpcPerCategory: vi.fn(),
}));

describe('prayer-personal-category-orchestrate', () => {
  const local = {
    prayers: [{ id: 'p1', category: 'Old' } as never],
    categories: [{ id: 'c1', name: 'Old' } as never],
    getPrayers: vi.fn(),
    setPrayers: vi.fn(),
    getCategories: vi.fn(),
    setCategories: vi.fn(),
  };

  beforeEach(() => {
    local.getPrayers.mockReturnValue(local.prayers);
    local.getCategories.mockReturnValue(local.categories);
    vi.clearAllMocks();
  });

  it('applyPersonalCategoryRenameSnapshot updates local state', () => {
    applyPersonalCategoryRenameSnapshot(local, 'Old', 'New');
    expect(local.setPrayers).toHaveBeenCalled();
    expect(local.setCategories).toHaveBeenCalled();
  });

  it('applyPersonalCategoryDeleteSnapshot updates local state', () => {
    applyPersonalCategoryDeleteSnapshot(local, 'Old');
    expect(local.setPrayers).toHaveBeenCalled();
    expect(local.setCategories).toHaveBeenCalled();
  });

  it('orchestratePersonalCategoryRename returns false when offline', async () => {
    const ok = await orchestratePersonalCategoryRename('Old', 'New', {
      requireOnline: () => false,
      toastError: vi.fn(),
      sanitize: (c) => c ?? null,
      getUniqueCategoryNames: vi.fn(),
      getTenantId: () => 't1',
      getUserEmail: vi.fn(),
      client: {} as never,
      local,
    });
    expect(ok).toBe(false);
  });

  it('orchestratePersonalCategoryDelete returns false when offline', async () => {
    const ok = await orchestratePersonalCategoryDelete('Old', {
      requireOnline: () => false,
      toastError: vi.fn(),
      sanitize: (c) => c ?? null,
      getTenantId: () => 't1',
      getUserEmail: vi.fn(),
      client: {} as never,
      local,
    });
    expect(ok).toBe(false);
  });

  it('orchestratePersonalCategoryReorder succeeds and rolls back on RPC error', async () => {
    vi.mocked(rpcReorderPersonalCategories).mockResolvedValue({ error: null });
    const ok = await orchestratePersonalCategoryReorder(['c1'], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(true);

    vi.mocked(rpcReorderPersonalCategories).mockResolvedValue({ error: new Error('rpc') });
    const failed = await orchestratePersonalCategoryReorder(['c1'], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(failed).toBe(false);
  });

  it('orchestratePersonalCategoryReorder returns true for empty id list', async () => {
    const ok = await orchestratePersonalCategoryReorder([], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(true);
    expect(rpcReorderPersonalCategories).not.toHaveBeenCalled();
  });

  it('orchestratePersonalPrayerOrderUpdate returns false when RPC fails', async () => {
    vi.mocked(runPersonalPrayerOrderRpcPerCategory).mockResolvedValue({
      ok: false,
      message: 'fail',
    });
    const ok = await orchestratePersonalPrayerOrderUpdate([], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(false);
  });

  it('orchestratePersonalCategoryRename validates tenant and renames remotely', async () => {
    const toastError = vi.fn();
    vi.mocked(rpcRenamePersonalCategory).mockResolvedValue({ error: null });
    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Old' }]);
    const ok = await orchestratePersonalCategoryRename('Old', 'New', {
      requireOnline: () => true,
      toastError,
      sanitize: (c) => c ?? null,
      getUniqueCategoryNames: async () => ['Old'],
      getTenantId: () => 't1',
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
    });
    expect(ok).toBe(true);
    expect(local.setPrayers).toHaveBeenCalled();
  });

  it('orchestratePersonalCategoryRename surfaces validation errors', async () => {
    const toastError = vi.fn();
    const ok = await orchestratePersonalCategoryRename('Old', 'Old', {
      requireOnline: () => true,
      toastError,
      sanitize: (c) => c ?? null,
      getUniqueCategoryNames: async () => ['Old'],
      getTenantId: () => 't1',
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
    });
    expect(ok).toBe(true);
    expect(rpcRenamePersonalCategory).not.toHaveBeenCalled();
  });

  it('orchestratePersonalCategoryRename requires tenant and email', async () => {
    const toastError = vi.fn();
    expect(
      await orchestratePersonalCategoryRename('Old', 'New', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getUniqueCategoryNames: async () => ['Old'],
        getTenantId: () => null,
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);
    expect(toastError).toHaveBeenCalledWith('No active organization selected');

    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Old' }]);
    expect(
      await orchestratePersonalCategoryRename('Old', 'New', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getUniqueCategoryNames: async () => ['Old'],
        getTenantId: () => 't1',
        getUserEmail: async () => null,
        client: {} as never,
        local,
      })
    ).toBe(false);
  });

  it('orchestratePersonalPrayerOrderUpdate succeeds when RPC ok', async () => {
    vi.mocked(runPersonalPrayerOrderRpcPerCategory).mockResolvedValue({ ok: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ok = await orchestratePersonalPrayerOrderUpdate([{ id: 'p1' } as never], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(true);
    logSpy.mockRestore();
  });

  it('orchestratePersonalCategoryReorder returns false without user email', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = await orchestratePersonalCategoryReorder(['c1'], {
      getUserEmail: async () => null,
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(false);
    errSpy.mockRestore();
  });

  it('orchestratePersonalCategoryReorder handles unexpected errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(rpcReorderPersonalCategories).mockRejectedValue(new Error('boom'));
    const ok = await orchestratePersonalCategoryReorder(['c1'], {
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
      runPrayerOrderRpc: vi.fn(),
    });
    expect(ok).toBe(false);
    errSpy.mockRestore();
  });

  it('orchestratePersonalPrayerOrderUpdate handles missing email and exceptions', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await orchestratePersonalPrayerOrderUpdate([], {
        getUserEmail: async () => null,
        client: {} as never,
        local,
        runPrayerOrderRpc: vi.fn(),
      })
    ).toBe(false);

    vi.mocked(runPersonalPrayerOrderRpcPerCategory).mockRejectedValue(new Error('x'));
    expect(
      await orchestratePersonalPrayerOrderUpdate([], {
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
        runPrayerOrderRpc: vi.fn(),
      })
    ).toBe(false);
    errSpy.mockRestore();
  });

  it('orchestratePersonalCategoryRename toasts validation failures', async () => {
    const toastError = vi.fn();
    const ok = await orchestratePersonalCategoryRename('Old', 'Taken', {
      requireOnline: () => true,
      toastError,
      sanitize: (c) => c ?? null,
      getUniqueCategoryNames: async () => ['Old', 'Taken'],
      getTenantId: () => 't1',
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
    });
    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Category "Taken" already exists');
  });

  it('orchestratePersonalCategoryRename handles missing category and RPC errors', async () => {
    const toastError = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Other' }]);
    expect(
      await orchestratePersonalCategoryRename('Old', 'New', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getUniqueCategoryNames: async () => ['Old'],
        getTenantId: () => 't1',
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Category not found');

    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Old' }]);
    vi.mocked(rpcRenamePersonalCategory).mockResolvedValue({
      error: new Error('rpc fail'),
    });
    expect(
      await orchestratePersonalCategoryRename('Old', 'New', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getUniqueCategoryNames: async () => ['Old'],
        getTenantId: () => 't1',
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Failed to rename category');
    errSpy.mockRestore();
  });

  it('orchestratePersonalCategoryDelete validates input and handles RPC failures', async () => {
    const toastError = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await orchestratePersonalCategoryDelete('   ', {
        requireOnline: () => true,
        toastError,
        sanitize: () => null,
        getTenantId: () => 't1',
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Category name is required');

    expect(
      await orchestratePersonalCategoryDelete('Old', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getTenantId: () => null,
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);

    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Other' }]);
    expect(
      await orchestratePersonalCategoryDelete('Old', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getTenantId: () => 't1',
        getUserEmail: async () => null,
        client: {} as never,
        local,
      })
    ).toBe(false);

    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Old' }]);
    vi.mocked(rpcDeletePersonalCategory).mockResolvedValue({
      error: new Error('delete fail'),
    });
    expect(
      await orchestratePersonalCategoryDelete('Old', {
        requireOnline: () => true,
        toastError,
        sanitize: (c) => c ?? null,
        getTenantId: () => 't1',
        getUserEmail: async () => 'user@example.com',
        client: {} as never,
        local,
      })
    ).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Failed to delete category');
    errSpy.mockRestore();
  });

  it('orchestratePersonalCategoryDelete removes category when RPC succeeds', async () => {
    const toastError = vi.fn();
    vi.mocked(rpcDeletePersonalCategory).mockResolvedValue({ error: null });
    local.getCategories.mockReturnValue([{ id: 'c1', name: 'Old' }]);
    const ok = await orchestratePersonalCategoryDelete('Old', {
      requireOnline: () => true,
      toastError,
      sanitize: (c) => c ?? null,
      getTenantId: () => 't1',
      getUserEmail: async () => 'user@example.com',
      client: {} as never,
      local,
    });
    expect(ok).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });
});
