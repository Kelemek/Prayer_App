import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { UserSettingsPrintSectionComponent } from './user-settings-print-section.component';

describe('UserSettingsPrintSectionComponent', () => {
  let component: UserSettingsPrintSectionComponent;
  let mockPrintService: {
    downloadPrintablePrayerList: ReturnType<typeof vi.fn>;
    downloadPrintablePromptList: ReturnType<typeof vi.fn>;
    downloadPrintablePersonalPrayerList: ReturnType<typeof vi.fn>;
  };
  let mockPrayerService: { getUniqueCategoriesForUser: ReturnType<typeof vi.fn> };
  let mockSupabase: { client: { from: ReturnType<typeof vi.fn> } };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrintService = {
      downloadPrintablePrayerList: vi.fn(() => Promise.resolve()),
      downloadPrintablePromptList: vi.fn(() => Promise.resolve()),
      downloadPrintablePersonalPrayerList: vi.fn(() => Promise.resolve()),
    };
    mockPrayerService = {
      getUniqueCategoriesForUser: vi.fn(() => Promise.resolve(['Health'])),
    };
    mockSupabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({
                  data: [{ name: 'Healing', display_order: 1 }],
                  error: null,
                })
              ),
            })),
          })),
        })),
      },
    };
    mockCdr = { markForCheck: vi.fn() };

    component = new UserSettingsPrintSectionComponent(
      mockPrintService as any,
      mockPrayerService as any,
      mockSupabase as any,
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
});
