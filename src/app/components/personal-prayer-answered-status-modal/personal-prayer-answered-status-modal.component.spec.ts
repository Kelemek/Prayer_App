import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonalPrayerAnsweredStatusModalComponent } from './personal-prayer-answered-status-modal.component';
import { ChangeDetectorRef } from '@angular/core';

describe('PersonalPrayerAnsweredStatusModalComponent', () => {
  let component: PersonalPrayerAnsweredStatusModalComponent;
  const prayerService = {
    getUniqueCategoriesForUser: vi.fn().mockResolvedValue(['Health', 'Answered', 'Family']),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    component = new PersonalPrayerAnsweredStatusModalComponent(
      prayerService as never,
      { markForCheck: vi.fn() } as ChangeDetectorRef
    );
  });

  it('confirms mark mode immediately', () => {
    component.mode = 'mark';
    const confirm = vi.fn();
    component.confirmMark.subscribe(confirm);
    component.onConfirm();
    expect(confirm).toHaveBeenCalled();
    expect(component.canConfirm).toBe(true);
  });

  it('blocks unmark when category is answered', () => {
    component.mode = 'unmark';
    component.category = 'answered';
    expect(component.canConfirm).toBe(false);
    component.onConfirm();
  });

  it('loads categories and filters on unmark open', async () => {
    component.isOpen = true;
    component.mode = 'unmark';
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      mode: { currentValue: 'unmark', previousValue: 'mark', firstChange: false, isFirstChange: () => false },
    });
    await Promise.resolve();
    expect(component.availableCategories).toEqual(['Health', 'Family']);
    component.category = 'he';
    component.onCategoryInput();
    expect(component.filteredCategories).toEqual(['Health']);
  });

  it('emits unmark with optional category', () => {
    component.mode = 'unmark';
    component.category = 'Family';
    const unmark = vi.fn();
    component.confirmUnmark.subscribe(unmark);
    component.onConfirm();
    expect(unmark).toHaveBeenCalledWith('Family');
    component.category = '  ';
    component.onConfirm();
    expect(unmark).toHaveBeenCalledWith(null);
  });

  it('closes dropdown on outside click', () => {
    component.showCategoryDropdown = true;
    component.onDocumentClick({ target: document.createElement('div') } as MouseEvent);
    expect(component.showCategoryDropdown).toBe(false);
    component.onCancel();
  });

  it('handles category keyboard navigation', () => {
    component.mode = 'unmark';
    component.availableCategories = ['Health', 'Family'];
    component.showCategoryDropdown = true;
    component.filteredCategories = ['Health', 'Family'];
    component.onCategoryKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as never);
    expect(component.selectedCategoryIndex).toBe(0);
    component.onCategoryKeyDown({ key: 'Enter', preventDefault: vi.fn() } as never);
    expect(component.category).toBe('Health');
  });
});
