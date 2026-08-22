import { describe, expect, it, vi } from 'vitest';
import { orchestratePersonalCategoryRename } from './prayer-personal-category-orchestrate';
import type { PrayerRequest } from './prayer-types';

describe('orchestratePersonalCategoryRename', () => {
  function makeDeps(overrides: Partial<Parameters<typeof orchestratePersonalCategoryRename>[2]> = {}) {
    const prayers: PrayerRequest[] = [
      { id: 'p1', category: 'Evening' } as PrayerRequest,
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
      } as any,
      local: {
        getPrayers: () => prayers,
        setPrayers: vi.fn((next: PrayerRequest[]) => {
          prayers.splice(0, prayers.length, ...next);
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
