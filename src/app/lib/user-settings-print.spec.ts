import { describe, expect, it, vi } from 'vitest';
import {
  runUserSettingsHandlePrint,
  runUserSettingsHandlePrintMemorizationCards,
  runUserSettingsHandlePrintPersonalPrayers,
  runUserSettingsHandlePrintPrompts,
  runUserSettingsLoadPersonalCategories,
  runUserSettingsLoadPromptTypes,
  toggleUserSettingsPersonalCategory,
  toggleUserSettingsPromptType,
} from './user-settings-print';

vi.mock('./print-native', () => ({
  isPrintNativeApp: vi.fn(() => false),
}));
import type { UserSettingsFacade } from './user-settings-facade';

function createHost(): UserSettingsFacade {
  return {
    isPrinting: false,
    isPrintingPrompts: false,
    isPrintingMemorization: false,
    isPrintingPersonal: false,
    printRange: 'month',
    selectedPromptTypes: ['Morning'],
    selectedPersonalCategories: ['Health'],
    promptTypes: [],
    personalCategories: [],
    deps: {
      cdr: { detectChanges: vi.fn() },
      printService: {
        downloadPrintablePrayerList: vi.fn().mockResolvedValue(undefined),
        downloadPrintablePromptList: vi.fn().mockResolvedValue(undefined),
        downloadPrintableMemorizationCards: vi.fn().mockResolvedValue(undefined),
        downloadPrintablePersonalPrayerList: vi.fn().mockResolvedValue(undefined),
      },
      tenantContext: { getActiveTenant: () => ({ id: 'tenant-1' }) },
      supabase: {
        client: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [{ name: 'Morning', display_order: 0 }],
              error: null,
            }),
          })),
        },
      },
      prayerService: {
        getUniqueCategoriesForUser: vi.fn().mockResolvedValue(['Health', 'Work']),
      },
    },
  } as unknown as UserSettingsFacade;
}

describe('user-settings-print', () => {
  it('runUserSettingsHandlePrint toggles printing flag', async () => {
    const host = createHost();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await runUserSettingsHandlePrint(host);
    expect(host.isPrinting).toBe(false);
    expect(host.deps.printService.downloadPrintablePrayerList).toHaveBeenCalled();
    open.mockRestore();
  });

  it('toggleUserSettingsPromptType adds and removes types', () => {
    const host = createHost();
    toggleUserSettingsPromptType(host, 'Evening');
    expect(host.selectedPromptTypes).toContain('Evening');
    toggleUserSettingsPromptType(host, 'Morning');
    expect(host.selectedPromptTypes).not.toContain('Morning');
  });

  it('toggleUserSettingsPersonalCategory toggles categories', () => {
    const host = createHost();
    toggleUserSettingsPersonalCategory(host, 'Work');
    expect(host.selectedPersonalCategories).toContain('Work');
    toggleUserSettingsPersonalCategory(host, 'Health');
    expect(host.selectedPersonalCategories).not.toContain('Health');
  });

  it('runUserSettingsLoadPromptTypes loads tenant types', async () => {
    const host = createHost();
    await runUserSettingsLoadPromptTypes(host);
    expect(host.promptTypes).toEqual(['Morning']);
  });

  it('runUserSettingsLoadPersonalCategories loads categories', async () => {
    const host = createHost();
    await runUserSettingsLoadPersonalCategories(host);
    expect(host.personalCategories).toEqual(['Health', 'Work']);
  });

  it('runUserSettingsHandlePrintPrompts and memorization/personal flows', async () => {
    const host = createHost();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await runUserSettingsHandlePrintPrompts(host);
    await runUserSettingsHandlePrintMemorizationCards(host);
    await runUserSettingsHandlePrintPersonalPrayers(host);
    expect(host.deps.printService.downloadPrintablePromptList).toHaveBeenCalled();
    expect(host.deps.printService.downloadPrintableMemorizationCards).toHaveBeenCalled();
    expect(host.deps.printService.downloadPrintablePersonalPrayerList).toHaveBeenCalled();
    open.mockRestore();
  });

  it('runUserSettingsLoadPromptTypes clears when no tenant', async () => {
    const host = createHost();
    host.deps.tenantContext.getActiveTenant = () => null;
    await runUserSettingsLoadPromptTypes(host);
    expect(host.promptTypes).toEqual([]);
  });

  it('runUserSettingsHandlePrint closes window on error', async () => {
    const host = createHost();
    const close = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ close } as never);
    host.deps.printService.downloadPrintablePrayerList = vi
      .fn()
      .mockRejectedValue(new Error('print fail'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runUserSettingsHandlePrint(host);
    expect(close).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
