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

  it('anchors the fixed menu to the trigger when the list exceeds the CSS max height', () => {
    component.escapeOverflowContainer = true;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      'button[aria-haspopup="listbox"]'
    ) as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 744,
      left: 16,
      right: 416,
      width: 400,
      height: 44,
      x: 16,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(430);

    trigger.click();
    fixture.detectChanges();

    const listbox = fixture.nativeElement.querySelector(
      '[role="listbox"]'
    ) as HTMLElement;
    const top = Number.parseFloat(listbox.style.top);
    const maxHeight = Number.parseFloat(listbox.style.maxHeight);
    expect(top + maxHeight + 4).toBe(700);
  });
});
