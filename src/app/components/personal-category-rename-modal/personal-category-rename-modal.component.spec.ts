import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonalCategoryRenameModalComponent } from './personal-category-rename-modal.component';

describe('PersonalCategoryRenameModalComponent', () => {
  let component: PersonalCategoryRenameModalComponent;

  beforeEach(() => {
    component = new PersonalCategoryRenameModalComponent();
  });

  it('syncs draft name when opened', () => {
    component.categoryName = 'Health';
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      categoryName: { currentValue: 'Health', previousValue: '', firstChange: true, isFirstChange: () => true },
    });
    expect(component.draftName).toBe('Health');
  });

  it('emits trimmed save payload', () => {
    const save = vi.fn();
    component.save.subscribe(save);
    component.draftName = '  Family  ';
    component.onSubmit();
    expect(save).toHaveBeenCalledWith('Family');
    component.draftName = '   ';
    component.onSubmit();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('schedules deferred focus after pointer release', () => {
    component.isOpen = true;
    component.deferInputFocus = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    document.dispatchEvent(new PointerEvent('pointerup'));
    component.ngOnDestroy();
  });

  it('clears deferred focus listeners on close', () => {
    component.isOpen = true;
    component.deferInputFocus = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    component.isOpen = false;
    component.ngOnChanges({
      isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
    });
    component.ngOnDestroy();
  });

  it('focuses and selects the input when the modal opens', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const focus = vi.fn();
    const select = vi.fn();
    component.categoryNameInput = {
      nativeElement: { focus, select, setSelectionRange: vi.fn(), value: 'Health' },
    } as never;
    component.isOpen = true;
    component.deferInputFocus = false;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      categoryName: { currentValue: 'Health', previousValue: '', firstChange: true, isFirstChange: () => true },
    });
    component.ngAfterViewInit();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(select).toHaveBeenCalled();
  });

  it('places the caret at the end when deferred focus completes', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const setSelectionRange = vi.fn();
    const focus = vi.fn();
    component.categoryNameInput = {
      nativeElement: { focus, select: vi.fn(), setSelectionRange, value: 'Health' },
    } as never;
    component.isOpen = true;
    component.deferInputFocus = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    document.dispatchEvent(new PointerEvent('pointerup'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(focus).toHaveBeenCalled();
    expect(setSelectionRange).toHaveBeenCalledWith(6, 6);
  });
});
