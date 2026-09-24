import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';
import { PersonalCategoryPillComponent } from './personal-category-pill.component';
import { PersonalCategoryColorService } from '../../services/personal-category-color.service';

function createPill(
  variant: 'pill' | 'header' = 'pill'
): PersonalCategoryPillComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PersonalCategoryColorService,
        useValue: {
          loadColors: vi.fn().mockResolvedValue(undefined),
          colors$: of({ Health: '#ff0000' }),
          getColor: vi.fn(() => '#ff0000'),
          getColorsSnapshot: vi.fn(() => ({ Health: '#ff0000' })),
          setColor: vi.fn().mockResolvedValue(true),
        },
      },
      {
        provide: ChangeDetectorRef,
        useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new PersonalCategoryPillComponent());
  component.category = 'Health';
  component.variant = variant;
  component.ngOnInit();
  return component;
}

describe('PersonalCategoryPillComponent', () => {
  it('builds pill styles from category color', () => {
    const component = createPill();
    expect(component.pillStyles).toBeTruthy();
    expect(component.layoutClasses).toBeTruthy();
  });

  it('opens and closes the picker on pill click', async () => {
    const component = createPill();
    const button = document.createElement('button');
    button.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 130,
        left: 10,
        right: 110,
        width: 100,
        height: 30,
      }) as DOMRect;
    const event = { stopPropagation: vi.fn(), currentTarget: button } as unknown as Event;
    component.onPillClick(event);
    expect(component.showPicker).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    component.onDocumentClick({ target: document.body } as MouseEvent);
    expect(component.showPicker).toBe(false);
  });

  it('emits picker open state for header variant', () => {
    const component = createPill('header');
    const openChange = vi.fn();
    component.pickerOpenChange.subscribe(openChange);
    const button = document.createElement('button');
    button.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 130,
        left: 10,
        right: 110,
        width: 100,
        height: 30,
      }) as DOMRect;
    component.onPillClick({
      stopPropagation: vi.fn(),
      currentTarget: button,
    } as unknown as Event);
    expect(openChange).toHaveBeenCalledWith(true);
    expect(component.pickerDropdownStyle).toBeTruthy();
  });

  it('applies picked color and closes on success', async () => {
    const component = createPill();
    component.showPicker = true;
    await component.onColorPick('#00ff00');
    expect(component.showPicker).toBe(false);
  });

  it('keeps picker open when color save fails', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PersonalCategoryColorService,
          useValue: {
            loadColors: vi.fn(),
            colors$: of({}),
            getColor: vi.fn(() => '#ff0000'),
            getColorsSnapshot: vi.fn(() => ({})),
            setColor: vi.fn().mockResolvedValue(false),
          },
        },
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() },
        },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PersonalCategoryPillComponent());
    component.category = 'Health';
    component.showPicker = true;
    await component.onColorPick('#00ff00');
    expect(component.showPicker).toBe(true);
  });

  it('ignores document clicks inside the pill', () => {
    const component = createPill();
    component.showPicker = true;
    const pillRoot = document.createElement('div');
    pillRoot.setAttribute('data-personal-category-pill', '');
    const inner = document.createElement('span');
    pillRoot.appendChild(inner);
    component.onDocumentClick({ target: inner } as MouseEvent);
    expect(component.showPicker).toBe(true);
  });

  it('handles pill click without an HTMLElement target', () => {
    const component = createPill();
    component.onPillClick({
      stopPropagation: vi.fn(),
      currentTarget: null,
    } as unknown as Event);
    expect(component.showPicker).toBe(true);
    expect(component.pickerOpenUp).toBe(false);
  });

  it('refines pill placement after open', async () => {
    const component = createPill();
    const button = document.createElement('button');
    button.getBoundingClientRect = () =>
      ({
        top: 400,
        bottom: 430,
        left: 10,
        right: 110,
        width: 100,
        height: 30,
      }) as DOMRect;
    const dropdown = document.createElement('div');
    dropdown.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 200,
        width: 200,
        height: 200,
      }) as DOMRect;
    component.pickerDropdownRef = { nativeElement: dropdown };
    component.onPillClick({
      stopPropagation: vi.fn(),
      currentTarget: button,
    } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(component.showPicker).toBe(true);
  });

  it('dismisses header picker when scrolled out of view', () => {
    const component = createPill('header');
    const root = document.createElement('div');
    root.className = 'safe-area-viewport';
    document.body.appendChild(root);
    const button = document.createElement('button');
    button.getBoundingClientRect = () =>
      ({
        top: -200,
        bottom: -170,
        left: 10,
        right: 110,
        width: 100,
        height: 30,
      }) as DOMRect;
    component.onPillClick({
      stopPropagation: vi.fn(),
      currentTarget: button,
    } as unknown as Event);
    root.dispatchEvent(new Event('scroll'));
    expect(component.showPicker).toBe(false);
    root.remove();
  });

  it('repositions header picker on viewport resize', () => {
    const component = createPill('header');
    const button = document.createElement('button');
    button.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 130,
        left: 10,
        right: 110,
        width: 100,
        height: 30,
      }) as DOMRect;
    component.onPillClick({
      stopPropagation: vi.fn(),
      currentTarget: button,
    } as unknown as Event);
    component.onViewportResize();
    expect(component.showPicker).toBe(true);
  });
});
