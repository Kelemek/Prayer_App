import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BibleTranslationPickerComponent } from './bible-translation-picker.component';
import { MemorizationService } from '../../services/memorization.service';

describe('BibleTranslationPickerComponent', () => {
  let fixture: ComponentFixture<BibleTranslationPickerComponent>;
  let component: BibleTranslationPickerComponent;
  const setPreferredTranslation = vi.fn();

  beforeEach(async () => {
    setPreferredTranslation.mockClear();
    await TestBed.configureTestingModule({
      imports: [BibleTranslationPickerComponent],
      providers: [
        {
          provide: MemorizationService,
          useValue: { setPreferredTranslation },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BibleTranslationPickerComponent);
    component = fixture.componentInstance;
    component.translation = 'esv';
    fixture.detectChanges();
  });

  it('shows selected translation label', () => {
    expect(component.selectedTranslationLabel).toContain('ESV');
    expect(fixture.nativeElement.textContent).toContain('ESV');
  });

  it('persists and emits when translation changes', () => {
    const translationChange = vi.fn();
    component.translationChange.subscribe(translationChange);

    component.setTranslation('niv');
    expect(setPreferredTranslation).toHaveBeenCalledWith('niv');
    expect(translationChange).toHaveBeenCalledWith('niv');
    expect(component.showDropdown).toBe(false);
  });

  it('toggles dropdown open state', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen).toBe(true);
    component.closeDropdown();
    expect(component.isDropdownOpen).toBe(false);
  });
});
