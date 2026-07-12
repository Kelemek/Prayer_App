import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { MemorizationReorderPanelComponent } from './memorization-reorder-panel.component';

describe('MemorizationReorderPanelComponent', () => {
  const chunks = [
    { id: 0, text: 'And we know' },
    { id: 1, text: 'that for those' },
    { id: 2, text: 'who love God' },
  ];

  beforeEach(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    } else {
      vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function slotEl(root: HTMLElement, index: number): HTMLElement {
    const el = root.querySelector(`[data-reorder-slot="${index}"]`) as HTMLElement;
    el.setPointerCapture = vi.fn();
    el.hasPointerCapture = vi.fn().mockReturnValue(true);
    el.releasePointerCapture = vi.fn();
    el.getBoundingClientRect = vi.fn().mockReturnValue({
      left: index * 80,
      top: 10,
      right: index * 80 + 70,
      bottom: 30,
      width: 70,
      height: 20,
      x: index * 80,
      y: 10,
      toJSON: () => ({}),
    });
    return el;
  }

  it('renders reading-order margin between verse chips', async () => {
    await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });

    const slots = screen.getAllByLabelText(/Verse part/i);
    expect(slots[0]?.className).toMatch(/mr-1\.5/);
    expect(slots[1]?.className).toMatch(/mr-1\.5/);
    expect(slots[2]?.className).not.toMatch(/mr-1\.5/);
  });

  it('slotNeedsTrailingSpace skips margin before chapter:verse colon', async () => {
    const refChunks = [
      { id: 0, text: 'For God' },
      { id: 1, text: 'so loved' },
      { id: 2, text: 'John' },
      { id: 3, text: '3' },
      { id: 4, text: '16' },
    ];
    await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks: refChunks,
        slotChunkIds: [0, 1, 2, 3, 4],
        roundMovableIndices: new Set<number>(),
        colonAfterSlotIndex: 3,
      },
    });

    const chapterSlot = screen.getByLabelText('Verse part 4 (fixed)');
    expect(chapterSlot.className).not.toMatch(/mr-1\.5/);
    expect(screen.getByTestId('memorize-reorder-chapter-verse-colon')).toBeTruthy();
  });

  it('slotClasses applies extraFixedSlotSpacing with mr-3', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
        extraFixedSlotSpacing: true,
      },
    });
    const component = fixture.componentInstance;
    const classes = component.slotClasses(0, false, false, false, true);
    expect(classes['mr-3']).toBe(true);
    expect(classes['mr-1.5']).toBe(false);
  });

  it('slotAriaLabel reflects locked, solved, and draggable states', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    const component = fixture.componentInstance;
    expect(component.slotAriaLabel(0, true, false)).toBe('Verse part 1 (fixed)');
    expect(component.slotAriaLabel(1, false, true)).toBe('Verse part 2 (in correct order)');
    expect(component.slotAriaLabel(2, false, false)).toBe('Verse part 3; drag to reorder');
  });

  it('swaps slots on drop and emits slotChunkIdsChange', async () => {
    const slotChunkIdsChange = vi.fn();
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.slotChunkIdsChange.subscribe(slotChunkIdsChange);
    fixture.componentInstance.usePointerPath = false;

    const el = document.createElement('div');
    el.scrollIntoView = vi.fn();
    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: '', setData: vi.fn(), dropEffect: '' },
      currentTarget: el,
    } as unknown as DragEvent;

    fixture.componentInstance.onDragStart(dragEvent, 1);
    await new Promise((r) => requestAnimationFrame(r));
    fixture.componentInstance.onDrop({ preventDefault: vi.fn() } as DragEvent, 2);

    expect(slotChunkIdsChange).toHaveBeenCalledWith([0, 1, 2]);
  });

  it('emits invalidDrop when dropping onto solved slot', async () => {
    const invalidDrop = vi.fn();
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.invalidDrop.subscribe(invalidDrop);
    fixture.componentInstance.usePointerPath = false;
    fixture.componentInstance.draggedSlot = 2;

    fixture.componentInstance.onDrop({ preventDefault: vi.fn() } as DragEvent, 0);
    expect(invalidDrop).toHaveBeenCalled();
  });

  it('prevents drag start on solved slots', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    const component = fixture.componentInstance;
    const preventDefault = vi.fn();
    const el = document.createElement('div');
    el.scrollIntoView = vi.fn();
    const event = {
      preventDefault,
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
      currentTarget: el,
    } as unknown as DragEvent;

    component.onDragStart(event, 0);
    expect(preventDefault).toHaveBeenCalled();
    expect(component.draggedSlot).toBeNull();
  });

  it('onDragEnd clears drag state', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.draggedSlot = 1;
    fixture.componentInstance.dragOverSlot = 2;
    fixture.componentInstance.onDragEnd();
    expect(fixture.componentInstance.draggedSlot).toBeNull();
    expect(fixture.componentInstance.dragOverSlot).toBeNull();
  });

  it('emits slotsBecameCorrect when swap fixes a slot', async () => {
    const slotsBecameCorrect = vi.fn();
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.slotsBecameCorrect.subscribe(slotsBecameCorrect);
    fixture.componentInstance.usePointerPath = false;
    fixture.componentInstance.draggedSlot = 1;

    fixture.componentInstance.onDrop({ preventDefault: vi.fn() } as DragEvent, 2);
    expect(slotsBecameCorrect).toHaveBeenCalled();
  });

  it('onDragOver sets dragOverSlot', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    const preventDefault = vi.fn();
    fixture.componentInstance.onDragOver(
      { preventDefault, dataTransfer: { dropEffect: '' } } as unknown as DragEvent,
      2
    );
    expect(fixture.componentInstance.dragOverSlot).toBe(2);
  });

  it('onDragLeave clears dragOverSlot', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.dragOverSlot = 2;
    fixture.componentInstance.onDragLeave();
    expect(fixture.componentInstance.dragOverSlot).toBeNull();
  });

  it('firstWrongSlotIndex returns first misordered slot', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    expect(fixture.componentInstance.firstWrongSlotIndex).toBe(1);
  });

  it('shows list flash error ring when listFlashError is true', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
        listFlashError: true,
      },
    });
    fixture.detectChanges();
    const ring = fixture.nativeElement.querySelector('.ring-red-400');
    expect(ring).toBeTruthy();
  });

  it('shows hold-hint peek text for first wrong slot', async () => {
    await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
        holdHintPeekFirstWrong: true,
      },
    });
    const peek = screen.getByLabelText('Verse part 2; drag to reorder').querySelector('.italic');
    expect(peek?.textContent).toContain('that for those');
  });

  it('detectPointerPath enables pointer path on coarse pointers', async () => {
    const listeners: Record<string, () => void> = {};
    const mql = {
      matches: true,
      addEventListener: vi.fn((_: string, fn: () => void) => {
        listeners.change = fn;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as typeof window.matchMedia;

    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    expect(fixture.componentInstance.usePointerPath).toBe(true);
    mql.matches = false;
    listeners.change?.();
    expect(fixture.componentInstance.usePointerPath).toBe(false);
  });

  it('pointer drag reorders via mouse movement threshold', async () => {
    const slotChunkIdsChange = vi.fn();
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.usePointerPath = true;
    fixture.componentInstance.slotChunkIdsChange.subscribe(slotChunkIdsChange);

    const list = screen.getByTestId('memorize-reorder-list');
    const slot1 = slotEl(list, 1);
    const slot2 = slotEl(list, 2);
    document.elementsFromPoint = vi.fn().mockReturnValue([slot2]);

    const down = new PointerEvent('pointerdown', {
      pointerId: 7,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      pointerType: 'mouse',
    });
    Object.defineProperty(down, 'target', { value: slot1 });
    fixture.componentInstance.onListPointerDown(down);

    document.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 7,
        clientX: 30,
        clientY: 30,
        bubbles: true,
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 7,
        clientX: 200,
        clientY: 30,
        bubbles: true,
      })
    );

    expect(slotChunkIdsChange).toHaveBeenCalled();
  });

  it('auto-scrolls scroll parent during HTML5 drag', async () => {
    const scrollParent = document.createElement('div');
    Object.defineProperty(scrollParent, 'scrollTop', { value: 100, writable: true });
    scrollParent.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      bottom: 200,
      left: 0,
      right: 300,
      width: 300,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(scrollParent, 'scrollHeight', { value: 1000 });
    Object.defineProperty(scrollParent, 'clientHeight', { value: 200 });

    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 2, 1],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.usePointerPath = false;
    fixture.componentInstance.scrollParentRef = scrollParent;
    const el = document.createElement('div');
    fixture.componentInstance.onDragStart(
      {
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
        currentTarget: el,
      } as unknown as DragEvent,
      1
    );

    const handler = (fixture.componentInstance as unknown as { documentDragOverHandler: ((ev: DragEvent) => void) | null })
      .documentDragOverHandler;
    expect(handler).toBeTruthy();
    handler?.({
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
      clientY: 10,
    } as unknown as DragEvent);
    expect(scrollParent.scrollTop).toBe(84);

    fixture.componentInstance.onDragEnd();
  });

  it('cleans up listeners on destroy', async () => {
    const { fixture } = await render(MemorizationReorderPanelComponent, {
      componentInputs: {
        chunks,
        slotChunkIds: [0, 1, 2],
        roundMovableIndices: new Set([1, 2]),
      },
    });
    fixture.componentInstance.usePointerPath = true;
    const list = screen.getByTestId('memorize-reorder-list');
    const slot1 = slotEl(list, 1);
    const down = new PointerEvent('pointerdown', {
      pointerId: 3,
      clientX: 5,
      clientY: 5,
      bubbles: true,
      pointerType: 'mouse',
    });
    Object.defineProperty(down, 'target', { value: slot1 });
    fixture.componentInstance.onListPointerDown(down);
    fixture.destroy();
    expect(fixture.componentInstance.draggedSlot).toBeNull();
  });
});
