import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ApplicationRef,
  ChangeDetectorRef,
  DestroyRef,
  ElementRef,
  TemplateRef,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ScriptureHoverPreviewComponent,
  clearScriptureHoverPreviewCacheForTests,
} from './scripture-hover-preview.component';
import { ScriptureService } from '../../services/scripture.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

describe('ScriptureHoverPreviewComponent', () => {
  let component: ScriptureHoverPreviewComponent;
  let getPassage: ReturnType<typeof vi.fn>;
  let markForCheck: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearScriptureHoverPreviewCacheForTests();
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.isNativePlatform as any).mockReturnValue(false);
    getPassage = vi.fn().mockResolvedValue({
      reference: 'John 3:16',
      text: 'For God so loved the world',
    });
    markForCheck = vi.fn();

    TestBed.configureTestingModule({
      imports: [ScriptureHoverPreviewComponent],
      providers: [
        { provide: ScriptureService, useValue: { getPassage } },
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck },
        },
      ],
    });

    const fixture = TestBed.createComponent(ScriptureHoverPreviewComponent);
    component = fixture.componentInstance;
    component.reference = 'John 3:16';
    component.translation = 'esv';
    component.hoverDelayMs = 50;
    fixture.detectChanges();
  });

  afterEach(() => {
    clearScriptureHoverPreviewCacheForTests();
    component.ngOnDestroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hides when disabled or reference cleared via ngOnChanges', () => {
    const hide = vi.spyOn(component as any, 'hide');
    component.disabled = true;
    component.ngOnChanges({
      disabled: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(hide).toHaveBeenCalled();

    component.disabled = false;
    component.reference = '  ';
    component.ngOnChanges({
      reference: {
        currentValue: '  ',
        previousValue: 'John 3:16',
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(hide).toHaveBeenCalledTimes(2);
  });

  it('shows preview after hover delay and uses cache on second open', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList);

    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, width: 40, height: 20, right: 140, bottom: 120 }),
    });

    component.onMouseEnter({
      currentTarget: trigger,
    } as unknown as MouseEvent);

    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    await Promise.resolve();

    expect(getPassage).toHaveBeenCalledWith('John 3:16', 'esv');
    expect(component.isVisible).toBe(true);
    expect(component.passage?.text).toContain('For God');

    component.onTriggerActivate();
    expect(component.isVisible).toBe(false);

    getPassage.mockClear();
    component.onMouseEnter({
      currentTarget: trigger,
    } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    expect(getPassage).not.toHaveBeenCalled();
    expect(component.passage?.reference).toBe('John 3:16');
  });

  it('handles fetch errors', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as MediaQueryList);
    getPassage.mockRejectedValue(new Error('network down'));

    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 10, width: 20, height: 20, right: 30, bottom: 30 }),
    });
    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.error).toBe('network down');
    expect(component.loading).toBe(false);
  });

  it('long-press flow on touch-only devices', async () => {
    vi.useFakeTimers();
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.isNativePlatform as any).mockReturnValue(true);

    const touch = { clientX: 50, clientY: 80 } as Touch;
    component.onTouchStart({
      changedTouches: [touch],
      touches: [touch],
    } as unknown as TouchEvent);

    await vi.advanceTimersByTimeAsync(520);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.openedByLongPress).toBe(true);
    expect(component.isVisible).toBe(true);

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    component.onTouchEnd({
      preventDefault,
      stopPropagation,
    } as unknown as TouchEvent);
    expect(preventDefault).toHaveBeenCalled();

    component.onBackdropTouchEnd({
      preventDefault: vi.fn(),
    } as unknown as TouchEvent);
    expect(component.isVisible).toBe(false);
  });

  it('cancels long-press on move and touchcancel', async () => {
    vi.useFakeTimers();
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.isNativePlatform as any).mockReturnValue(true);

    const touch = { clientX: 10, clientY: 10 } as Touch;
    component.onTouchStart({
      changedTouches: [touch],
      touches: [touch],
    } as unknown as TouchEvent);

    component.onTouchMove({
      changedTouches: [{ clientX: 40, clientY: 40 }],
      touches: [{ clientX: 40, clientY: 40 }],
    } as unknown as TouchEvent);

    await vi.advanceTimersByTimeAsync(520);
    expect(component.isVisible).toBe(false);

    component.onTouchStart({
      changedTouches: [touch],
      touches: [touch],
    } as unknown as TouchEvent);
    await vi.advanceTimersByTimeAsync(520);
    await Promise.resolve();
    component.onTouchCancel();
    expect(component.isVisible).toBe(false);
  });

  it('keyboard and escape dismiss', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 }),
    });
    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    await Promise.resolve();

    component.onTriggerKeydown({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(component.isVisible).toBe(false);

    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    component.onDocumentKeydown({ key: 'Escape' } as KeyboardEvent);
    expect(component.isVisible).toBe(false);
  });

  it('popover mouse enter cancels hide; leave hides hover preview', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 20, top: 20, width: 10, height: 10, right: 30, bottom: 30 }),
    });
    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.isVisible).toBe(true);

    component.onPopoverMouseEnter();
    component.onMouseLeave();
    await vi.advanceTimersByTimeAsync(200);
    expect(component.isVisible).toBe(true);

    component.onPopoverMouseLeave();
    expect(component.isVisible).toBe(false);
  });

  it('blocks context menu on touch devices', async () => {
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    const preventDefault = vi.fn();
    component.onTriggerContextMenu({ preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('positions popover below when there is no room above', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    (component as any).setPositionFromPoint(200, 20);
    expect(component.isAbove).toBe(false);
    expect(component.popoverWidthPx).toBeGreaterThan(0);
  });

  it('dismisses on scroll, resize, blur, and outside pointerdown', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 50, top: 50, width: 20, height: 20, right: 70, bottom: 70 }),
    });
    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.isVisible).toBe(true);

    (component as any).handleScrollDismiss({ target: document.body } as Event);
    expect(component.isVisible).toBe(false);

    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    (component as any).handleResizeDismiss();
    expect(component.isVisible).toBe(false);

    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    (component as any).onBlurHide();
    expect(component.isVisible).toBe(false);

    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    await Promise.resolve();
    (component as any).handlePointerDownDismiss({
      target: document.body,
    } as PointerEvent);
    expect(component.isVisible).toBe(false);
  });

  it('blocks activate while long-press preview is open', async () => {
    vi.useFakeTimers();
    const { Capacitor } = await import('@capacitor/core');
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    const touch = { clientX: 30, clientY: 40 } as Touch;
    component.onTouchStart({
      changedTouches: [touch],
      touches: [touch],
    } as unknown as TouchEvent);
    await vi.advanceTimersByTimeAsync(520);
    await Promise.resolve();

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    component.onTriggerActivate({
      preventDefault,
      stopPropagation,
    } as unknown as Event);
    expect(preventDefault).toHaveBeenCalled();
    expect(component.isVisible).toBe(false);
  });

  it('ignores stale fetch when preview closed mid-request', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    let resolvePassage!: (v: unknown) => void;
    getPassage.mockReturnValue(
      new Promise((resolve) => {
        resolvePassage = resolve;
      })
    );
    const trigger = document.createElement('div');
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 10, width: 10, height: 10, right: 20, bottom: 20 }),
    });
    component.onMouseEnter({ currentTarget: trigger } as unknown as MouseEvent);
    await vi.advanceTimersByTimeAsync(60);
    component.onTriggerActivate();
    resolvePassage({ reference: 'John 3:16', text: 'late' });
    await Promise.resolve();
    await Promise.resolve();
    expect(component.passage?.text).not.toBe('late');
  });
});
