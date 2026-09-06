import { describe, expect, it, vi } from 'vitest';
import { orchestratePersonalCategoryDelete, orchestratePersonalCategoryRename } from './prayer-personal-category-orchestrate';
import type { PersonalCategory } from '../types/personal-category';
import type { PrayerRequest } from './prayer-types';

describe('orchestratePersonalCategoryRename', () => {
  function makeDeps(overrides: Partial<Parameters<typeof orchestratePersonalCategoryRename>[2]> = {}) {
    const prayers: PrayerRequest[] = [
      { id: 'p1', category: 'Evening' } as PrayerRequest,
    ];
    const categories: PersonalCategory[] = [
      { id: 'cat-1', name: 'Evening', display_order: 0, color: null },
    ];
    return {
      requireOnline: () => true,
      toastError: vi.fn(),
      sanitize: (category: string | null | undefined) => category?.trim() || null,
      getUniqueCategoryNames: async () => ['Evening'],
      getTenantId: () => 'tenant-1',
      getUserEmail: async () => 'user@example.com',
      client: {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      } as any,
      local: {
        getPrayers: () => prayers,
        setPrayers: vi.fn((next: PrayerRequest[]) => {
          prayers.splice(0, prayers.length, ...next);
        }),
        getCategories: () => categories,
        setCategories: vi.fn((next: PersonalCategory[]) => {
          categories.splice(0, categories.length, ...next);
        }),
      },
      ...overrides,
    };
  }

  it('fails closed when offline', async () => {
    const deps = makeDeps({ requireOnline: () => false });
    await expect(
      orchestratePersonalCategoryRename('Evening', 'Night', deps)
    ).resolves.toBe(false);
    expect(deps.toastError).not.toHaveBeenCalled();
  });

  it('fails closed without an active tenant', async () => {
    const deps = makeDeps({ getTenantId: () => null });
    await expect(
      orchestratePersonalCategoryRename('Evening', 'Night', deps)
    ).resolves.toBe(false);
    expect(deps.toastError).toHaveBeenCalledWith('No active organization selected');
  });

  it('returns true when the sanitized name is unchanged', async () => {
    const deps = makeDeps();
    await expect(
      orchestratePersonalCategoryRename(' Evening ', 'Evening', deps)
    ).resolves.toBe(true);
  });
});

describe('orchestratePersonalCategoryDelete', () => {
  function makeDeps(
    overrides: Partial<Parameters<typeof orchestratePersonalCategoryDelete>[1]> = {}
  ) {
    const prayers: PrayerRequest[] = [
      { id: 'p1', category: 'Evening' } as PrayerRequest,
    ];
    const categories: PersonalCategory[] = [
      { id: 'cat-1', name: 'Evening', display_order: 0, color: null },
    ];
    return {
      requireOnline: () => true,
      toastError: vi.fn(),
      sanitize: (category: string | null | undefined) => category?.trim() || null,
      getTenantId: () => 'tenant-1',
      getUserEmail: async () => 'user@example.com',
      client: {
        from: vi.fn(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      } as any,
      local: {
        getPrayers: () => prayers,
        setPrayers: vi.fn((next: PrayerRequest[]) => {
          prayers.splice(0, prayers.length, ...next);
        }),
        getCategories: () => categories,
        setCategories: vi.fn((next: PersonalCategory[]) => {
          categories.splice(0, categories.length, ...next);
        }),
      },
      ...overrides,
    };
  }

  it('fails closed when offline', async () => {
    const deps = makeDeps({ requireOnline: () => false });
    await expect(
      orchestratePersonalCategoryDelete('Evening', deps)
    ).resolves.toBe(false);
    expect(deps.toastError).not.toHaveBeenCalled();
  });

  it('fails closed without an active tenant', async () => {
    const deps = makeDeps({ getTenantId: () => null });
    await expect(
      orchestratePersonalCategoryDelete('Evening', deps)
    ).resolves.toBe(false);
    expect(deps.toastError).toHaveBeenCalledWith('No active organization selected');
  });
});
