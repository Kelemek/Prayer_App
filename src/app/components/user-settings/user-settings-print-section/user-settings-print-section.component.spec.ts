import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { UserSettingsPrintSectionComponent } from './user-settings-print-section.component';

describe('UserSettingsPrintSectionComponent', () => {
  let component: UserSettingsPrintSectionComponent;
  let mockPrintService: {
    downloadPrintablePrayerList: ReturnType<typeof vi.fn>;
    downloadPrintablePromptList: ReturnType<typeof vi.fn>;
    downloadPrintablePersonalPrayerList: ReturnType<typeof vi.fn>;
    downloadPrintableGroupPrayerList: ReturnType<typeof vi.fn>;
    downloadPrintableMemorizationCards: ReturnType<typeof vi.fn>;
  };
  let mockPrayerService: { getUniqueCategoriesForUser: ReturnType<typeof vi.fn> };
  let mockPrayerGroupService: {
    loadMyGroups: ReturnType<typeof vi.fn>;
    loadGroupPrayersForPrint: ReturnType<typeof vi.fn>;
  };
  let mockSupabase: { client: { from: ReturnType<typeof vi.fn> } };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let mockTenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    mockPrintService = {
      downloadPrintablePrayerList: vi.fn(() => Promise.resolve()),
      downloadPrintablePromptList: vi.fn(() => Promise.resolve()),
      downloadPrintablePersonalPrayerList: vi.fn(() => Promise.resolve()),
      downloadPrintableGroupPrayerList: vi.fn(() => Promise.resolve()),
      downloadPrintableMemorizationCards: vi.fn(() => Promise.resolve()),
    };
    mockPrayerService = {
      getUniqueCategoriesForUser: vi.fn(() => Promise.resolve(['Health'])),
    };
    mockPrayerGroupService = {
      loadMyGroups: vi.fn(() => Promise.resolve([{ id: 'group-1', name: 'Youth' }])),
      loadGroupPrayersForPrint: vi.fn(() => Promise.resolve([])),
    };
    mockSupabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      { name: 'Healing', display_order: 1 },
                      { name: 'Healing', display_order: 2 },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
      },
    };
    mockCdr = { markForCheck: vi.fn() };
    mockTenantContext = {
      getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
    };

    component = new UserSettingsPrintSectionComponent(
      mockPrintService as any,
      mockPrayerService as any,
      mockSupabase as any,
      mockTenantContext as any,
      mockPrayerGroupService as any,
      mockCdr as unknown as ChangeDetectorRef
    );
  });

  it('setPrintRange updates printRange', () => {
    component.setPrintRange('month');
    expect(component.printRange).toBe('month');
  });

  it('handlePrint calls print service with current range', async () => {
    component.printRange = 'year';
    await component.handlePrint();
    expect(mockPrintService.downloadPrintablePrayerList).toHaveBeenCalledWith(
      'year',
      expect.anything()
    );
    expect(component.isPrinting).toBe(false);
  });

  it('loads prompt types when opened', async () => {
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    await Promise.resolve();
    expect(component.promptTypes).toEqual(['Healing']);
  });

  it('togglePromptType adds and removes types', () => {
    component.togglePromptType('Healing');
    expect(component.selectedPromptTypes).toEqual(['Healing']);
    component.togglePromptType('Healing');
    expect(component.selectedPromptTypes).toEqual([]);
  });

  it('togglePersonalCategory tracks selected categories', () => {
    component.togglePersonalCategory('Health');
    expect(component.selectedPersonalCategories).toEqual(['Health']);
    component.togglePersonalCategory('Health');
    expect(component.selectedPersonalCategories).toEqual([]);
  });

  it('handlePrintPrompts passes selected types to print service', async () => {
    component.selectedPromptTypes = ['Healing'];
    await component.handlePrintPrompts();
    expect(mockPrintService.downloadPrintablePromptList).toHaveBeenCalledWith(
      ['Healing'],
      expect.anything()
    );
    expect(component.isPrintingPrompts).toBe(false);
  });

  it('handlePrintPersonalPrayers passes categories when selected', async () => {
    component.selectedPersonalCategories = ['Family'];
    await component.handlePrintPersonalPrayers();
    expect(mockPrintService.downloadPrintablePersonalPrayerList).toHaveBeenCalledWith(
      ['Family'],
      expect.anything(),
      'week'
    );
  });

  it('handlePrintMemorizationCards calls print service with sheet style', async () => {
    component.memorizationSheetStyle = 'foldable';
    await component.handlePrintMemorizationCards();
    expect(mockPrintService.downloadPrintableMemorizationCards).toHaveBeenCalledWith(
      expect.anything(),
      'foldable'
    );
    expect(component.isPrintingMemorization).toBe(false);
  });

  it('printFromOptionsModal for verses closes modal and prints', async () => {
    component.openPrintOptionsModal('verses');
    component.memorizationSheetStyle = 'duplex';
    await component.printFromOptionsModal();
    expect(component.printOptionsModal).toBeNull();
    expect(mockPrintService.downloadPrintableMemorizationCards).toHaveBeenCalledWith(
      expect.anything(),
      'duplex'
    );
  });

  it('openPrintOptionsModal starts the prayer chooser', () => {
    component.openPrintOptionsModal('prayers');
    expect(component.printOptionsModal).toBe('prayers');
    expect(component.prayerPrintStep).toBe('source');
    component.closePrintOptionsModal();
    expect(component.printOptionsModal).toBeNull();
  });

  it('setPrintRange from modal keeps modal open', () => {
    component.openPrintOptionsModal('prayers');
    component.setPrintRange('month');
    expect(component.printRange).toBe('month');
    expect(component.printOptionsModal).toBe('prayers');
  });

  it('printFromOptionsModal closes modal and prints church prayers', async () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('church');
    component.printRange = 'year';
    await component.printFromOptionsModal();
    expect(component.printOptionsModal).toBeNull();
    expect(mockPrintService.downloadPrintablePrayerList).toHaveBeenCalledWith(
      'year',
      expect.anything()
    );
  });

  it('prompts ask for a category and skip the timeframe', () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('prompts');
    expect(component.prayerPrintStep).toBe('prompts');
    expect(component.printOptionsModalTitle).toBe('Prompt category');
  });

  it('groups ask for a group then a timeframe', () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('groups');
    expect(component.prayerPrintStep).toBe('group');
    component.choosePrintGroup('group-1');
    expect(component.prayerPrintStep).toBe('timeframe');
    component.backPrayerPrintStep();
    expect(component.prayerPrintStep).toBe('group');
  });

  it('personal asks for a category then a timeframe', () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('personal');
    expect(component.prayerPrintStep).toBe('category');
    component.choosePrintPersonalCategory('Health');
    expect(component.selectedPersonalCategories).toEqual(['Health']);
    expect(component.prayerPrintStep).toBe('timeframe');
  });

  it('prints the selected group for the chosen timeframe', async () => {
    component.printGroups = [{ id: 'group-1', name: 'Youth' } as any];
    component.openPrintOptionsModal('prayers');
    component.prayerPrintSource = 'groups';
    component.selectedPrintGroupId = 'group-1';
    component.prayerPrintStep = 'timeframe';
    component.printRange = 'month';
    await component.printFromOptionsModal();
    expect(mockPrayerGroupService.loadGroupPrayersForPrint).toHaveBeenCalledWith('group-1');
    expect(mockPrintService.downloadPrintableGroupPrayerList).toHaveBeenCalledWith(
      [],
      'Youth',
      'month',
      expect.anything()
    );
  });

  it('closes print options modal when settings section closes', () => {
    component.openPrintOptionsModal('prayers');
    component.ngOnChanges({
      isOpen: {
        currentValue: false,
        previousValue: true,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(component.printOptionsModal).toBeNull();
  });

  it('exposes modal titles and action labels for each wizard step', () => {
    component.openPrintOptionsModal('verses');
    expect(component.printOptionsModalTitle).toBe('Verse card format');

    component.openPrintOptionsModal('prayers');
    expect(component.printOptionsModalTitle).toBe('What to print');

    component.choosePrayerPrintSource('church');
    expect(component.printOptionsModalTitle).toBe('Time period');
    expect(component.prayerPrintActionLabel).toBe('Print Church');
    expect(component.prayerPrintActionDisabled).toBe(false);

    component.prayerPrintSource = 'groups';
    expect(component.prayerPrintActionLabel).toBe('Print Group');
    expect(component.prayerPrintActionDisabled).toBe(true);
    component.selectedPrintGroupId = 'group-1';
    expect(component.prayerPrintActionDisabled).toBe(false);
  });

  it('backs out of the wizard from source and timeframe steps', () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('personal');
    component.backPrayerPrintStep();
    expect(component.prayerPrintStep).toBe('source');

    component.choosePrayerPrintSource('church');
    component.backPrayerPrintStep();
    expect(component.prayerPrintStep).toBe('source');

    component.backPrayerPrintStep();
    expect(component.printOptionsModal).toBeNull();
  });

  it('no-ops closePrintOptionsModal when already closed', () => {
    component.printOptionsModal = null;
    component.closePrintOptionsModal();
    expect(component.printOptionsModal).toBeNull();
  });

  it('tracks busy state across print actions', () => {
    component.isPrinting = true;
    expect(component.prayersTileBusy).toBe(true);
    component.isPrinting = false;
    component.isPrintingPrompts = true;
    expect(component.prayersTileBusy).toBe(true);
  });

  it('clears prompt type selection with selectAllPromptTypes', () => {
    component.selectedPromptTypes = ['Healing'];
    component.selectAllPromptTypes();
    expect(component.selectedPromptTypes).toEqual([]);
  });

  it('sets memorization sheet style', () => {
    component.setMemorizationSheetStyle('foldable');
    expect(component.memorizationSheetStyle).toBe('foldable');
  });

  it('backs from timeframe to the prior wizard step', () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('prompts');
    component.prayerPrintStep = 'timeframe';
    component.backPrayerPrintStep();
    expect(component.prayerPrintStep).toBe('source');

    component.choosePrayerPrintSource('groups');
    component.selectedPrintGroupId = 'group-1';
    component.prayerPrintStep = 'timeframe';
    component.backPrayerPrintStep();
    expect(component.prayerPrintStep).toBe('group');
  });

  it('choosePrintPersonalCategory clears selection when null', () => {
    component.choosePrintPersonalCategory(null);
    expect(component.selectedPersonalCategories).toEqual([]);
    expect(component.prayerPrintStep).toBe('timeframe');
  });

  it('skips handlePrintGroup when no group is selected', async () => {
    component.selectedPrintGroupId = null;
    await component.handlePrintGroup();
    expect(mockPrintService.downloadPrintableGroupPrayerList).not.toHaveBeenCalled();
  });

  it('prints prompts and personal flows from the modal wizard', async () => {
    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('prompts');
    component.selectedPromptTypes = ['Healing'];
    await component.printFromOptionsModal();
    expect(mockPrintService.downloadPrintablePromptList).toHaveBeenCalled();

    component.openPrintOptionsModal('prayers');
    component.choosePrayerPrintSource('personal');
    component.selectedPersonalCategories = [];
    await component.printFromOptionsModal();
    expect(mockPrintService.downloadPrintablePersonalPrayerList).toHaveBeenCalledWith(
      undefined,
      expect.anything(),
      'week'
    );
  });

  it('loads groups and personal categories when opened', async () => {
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    await Promise.resolve();
    expect(component.printGroups).toEqual([{ id: 'group-1', name: 'Youth' }]);
    expect(component.personalCategories).toEqual(['Health']);
  });

  it('handles load failures for groups and categories', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPrayerGroupService.loadMyGroups.mockRejectedValueOnce(new Error('groups'));
    mockPrayerService.getUniqueCategoriesForUser.mockRejectedValueOnce(
      new Error('cats')
    );
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    await Promise.resolve();
    expect(component.printGroups).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('clears prompt types when there is no active tenant', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    await Promise.resolve();
    expect(component.promptTypes).toEqual([]);
  });

  it('detects native Capacitor platforms for print windows', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    const openSpy = vi.spyOn(window, 'open');
    await component.handlePrint();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it('closes print windows when memorization printing fails', async () => {
    const close = vi.fn();
    const doc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    window.open = vi.fn(
      () => ({ close, focus: vi.fn(), document: doc }) as unknown as Window
    );
    mockPrintService.downloadPrintableMemorizationCards.mockRejectedValueOnce(
      new Error('mem')
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await component.handlePrintMemorizationCards();

    expect(close).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('closes print window when prayer print fails', async () => {
    const close = vi.fn();
    window.open = vi.fn(() => ({ close }) as unknown as Window);
    mockPrintService.downloadPrintablePrayerList.mockRejectedValue(new Error('fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await component.handlePrint();

    expect(close).toHaveBeenCalled();
    expect(component.isPrinting).toBe(false);
    consoleSpy.mockRestore();
  });
});
