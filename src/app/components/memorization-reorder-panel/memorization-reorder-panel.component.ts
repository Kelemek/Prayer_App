import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import type { MemorizationReorderChunk } from '../../lib/memorization/memorizationPracticeUtils';

const POINTER_REORDER_TOUCH_DELAY_MS = 110;
const POINTER_REORDER_MOUSE_MOVE_THRESHOLD_PX = 5;

type PendingSession = {
  pointerId: number;
  slotIndex: number;
  startX: number;
  startY: number;
  touchLike: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function slotIndexUnderPointer(listRoot: HTMLElement, clientX: number, clientY: number): number | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const li = node.closest('[data-reorder-slot]');
    if (!li || !listRoot.contains(li)) continue;
    const raw = li.getAttribute('data-reorder-slot');
    if (raw == null) continue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

@Component({
  selector: 'app-memorization-reorder-panel',
  standalone: true,
  imports: [CommonModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-md"
      [class.ring-2]="listFlashError"
      [class.ring-red-400]="listFlashError"
      [class.dark:ring-red-500]="listFlashError"
      [class.p-1]="listFlashError"
    >
      <div
        #listRoot
        data-testid="memorize-reorder-list"
        class="flex flex-wrap items-baseline gap-y-2 sm:gap-y-1 text-base leading-relaxed font-serif"
        [ngClass]="className"
        (pointerdown)="onListPointerDown($event)"
      >
        @for (slotIndex of slotIndices; track slotIndex) {
          @let chunkId = slotChunkIds[slotIndex];
          @let chunk = chunks[chunkId];
          @let text = chunk.text;
          @let showHoldPeek =
            holdHintPeekFirstWrong &&
            firstWrongSlotIndex === slotIndex &&
            slotChunkIds[slotIndex] !== slotIndex;
          @let peekText = chunks[slotIndex].text;
          @let displayText = showHoldPeek ? peekText : text;
          @let isSolved = slotChunkIds[slotIndex] === slotIndex;
          @let wasInRoundShuffle = roundMovableIndices.has(slotIndex);
          @let lockedByRound = !wasInRoundShuffle;
          @let draggable = !lockedByRound && !isSolved;
          @let needsAttention = wasInRoundShuffle && !isSolved;
          @let isDragging = draggedSlot === slotIndex;
          @let isDragOver = dragOverSlot === slotIndex;
          @let nativeDraggable = draggable && !usePointerPath;

          <div
            [attr.data-reorder-slot]="slotIndex"
            [attr.draggable]="nativeDraggable ? true : null"
            class="min-w-0 max-w-full rounded-md text-gray-800 dark:text-gray-100 wrap-anywhere hyphens-auto select-none [-webkit-touch-callout:none]"
            [ngClass]="slotClasses(slotIndex, needsAttention, isDragOver, isDragging, draggable)"
            [attr.aria-label]="slotAriaLabel(slotIndex, lockedByRound, isSolved)"
            (dragstart)="onDragStart($event, slotIndex)"
            (dragover)="onDragOver($event, slotIndex)"
            (dragleave)="onDragLeave()"
            (drop)="onDrop($event, slotIndex)"
            (dragend)="onDragEnd()"
          >
            <span
              class="pointer-events-none"
              [class.text-blue-800]="showHoldPeek"
              [class.dark:text-blue-200]="showHoldPeek"
              [class.italic]="showHoldPeek"
            >
              {{ displayText }}
            </span>
          </div>
          @if (colonAfterSlotIndex === slotIndex) {
            <span
              data-testid="memorize-reorder-chapter-verse-colon"
              aria-hidden="true"
              class="text-gray-800 dark:text-gray-100 shrink-0 self-baseline pointer-events-none select-none"
            >
              :
            </span>
          }
        }
      </div>
    </div>

    @if (usePointerPath && draggedSlot !== null && pointerDragPreview && pointerDragLabel) {
      <div
        aria-hidden="true"
        data-testid="memorize-reorder-drag-preview"
        class="fixed z-[200] w-max max-w-none whitespace-nowrap rounded-md px-2.5 py-1 text-base leading-relaxed font-serif pointer-events-none select-none shadow-xl border-2 border-amber-300 dark:border-amber-600/80 bg-amber-50/95 dark:bg-amber-950/90 text-gray-800 dark:text-gray-100"
        [style.left.px]="pointerDragPreview.x"
        [style.top.px]="pointerDragPreview.y"
        [style.transform]="'translate(-50%, calc(-100% - 10px))'"
      >
        {{ pointerDragLabel }}
      </div>
    }
  `,
})
export class MemorizationReorderPanelComponent implements OnInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) chunks: MemorizationReorderChunk[] = [];
  @Input({ required: true }) slotChunkIds: number[] = [];
  @Input({ required: true }) roundMovableIndices = new Set<number>();
  @Input() listFlashError = false;
  @Input() holdHintPeekFirstWrong = false;
  @Input() scrollParentRef: HTMLElement | null = null;
  @Input() className = '';
  @Input() colonAfterSlotIndex: number | null = null;
  @Input() extraFixedSlotSpacing = false;

  @Output() slotChunkIdsChange = new EventEmitter<number[]>();
  @Output() invalidDrop = new EventEmitter<void>();
  @Output() slotsBecameCorrect = new EventEmitter<number[]>();

  @ViewChild('listRoot') listRef?: ElementRef<HTMLDivElement>;

  slotIndices: number[] = [];
  draggedSlot: number | null = null;
  dragOverSlot: number | null = null;
  pointerDragPreview: { x: number; y: number } | null = null;
  pointerDragLabel = '';
  usePointerPath = false;

  private pending: PendingSession | null = null;
  private activeDragPointerId: number | null = null;
  private purgePointerListeners: (() => void) | null = null;
  private documentDragOverHandler: ((ev: DragEvent) => void) | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryHandler: (() => void) | null = null;

  get firstWrongSlotIndex(): number | null {
    for (let i = 0; i < this.slotChunkIds.length; i++) {
      if (this.slotChunkIds[i] !== i) return i;
    }
    return null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chunks']) {
      this.slotIndices = Array.from({ length: this.chunks.length }, (_, i) => i);
    }
    if (changes['draggedSlot'] || changes['slotChunkIds'] || changes['holdHintPeekFirstWrong']) {
      this.updatePointerDragLabel();
    }
  }

  ngOnInit(): void {
    this.detectPointerPath();
  }

  ngOnDestroy(): void {
    this.purgePointerListeners?.();
    this.purgePointerListeners = null;
    this.clearPending();
    if (this.documentDragOverHandler) {
      document.removeEventListener('dragover', this.documentDragOverHandler);
    }
    if (this.mediaQuery && this.mediaQueryHandler) {
      this.mediaQuery.removeEventListener('change', this.mediaQueryHandler);
    }
  }

  slotAriaLabel(slotIndex: number, lockedByRound: boolean, isSolved: boolean): string {
    if (lockedByRound) return `Verse part ${slotIndex + 1} (fixed)`;
    if (isSolved) return `Verse part ${slotIndex + 1} (in correct order)`;
    return `Verse part ${slotIndex + 1}; drag to reorder`;
  }

  /** Reading-order space between chips (not before a static chapter:verse colon). */
  slotNeedsTrailingSpace(slotIndex: number): boolean {
    if (slotIndex >= this.slotIndices.length - 1) return false;
    if (this.colonAfterSlotIndex === slotIndex) return false;
    return true;
  }

  /** ngClass map — fractional/responsive Tailwind must not use `[class.mr-1.5]` (Angular parses the dot). */
  slotClasses(
    slotIndex: number,
    needsAttention: boolean,
    isDragOver: boolean,
    isDragging: boolean,
    draggable: boolean,
  ): Record<string, boolean> {
    const trail = this.slotNeedsTrailingSpace(slotIndex);
    return {
      'transition-shadow': this.draggedSlot === null,
      'mr-1.5': trail && !this.extraFixedSlotSpacing,
      'mr-3': trail && this.extraFixedSlotSpacing,
      'px-2.5': needsAttention,
      'py-1': needsAttention,
      'sm:px-2': needsAttention,
      'sm:py-0.5': needsAttention,
      'ring-2': isDragOver || needsAttention,
      'ring-blue-400': isDragOver,
      'dark:ring-blue-500': isDragOver,
      'ring-amber-300': needsAttention && !isDragOver,
      'dark:ring-amber-600/80': needsAttention && !isDragOver,
      'bg-amber-50/90': needsAttention && !isDragOver,
      'dark:bg-amber-950/35': needsAttention && !isDragOver,
      'ring-transparent': !isDragOver && !needsAttention,
      'opacity-35': isDragging && this.usePointerPath,
      'opacity-60': isDragging && !this.usePointerPath,
      'cursor-move': draggable,
      'touch-none': draggable && this.usePointerPath,
      'touch-manipulation': draggable && !this.usePointerPath,
      'cursor-default': !draggable,
    };
  }

  onListPointerDown(event: PointerEvent): void {
    if (!this.usePointerPath) return;
    const root = this.listRef?.nativeElement;
    if (!root) return;
    const li = (event.target as Element | null)?.closest?.('[data-reorder-slot]');
    if (!li || !root.contains(li)) return;
    const raw = li.getAttribute('data-reorder-slot');
    if (raw == null) return;
    const slotIndex = Number(raw);
    if (!Number.isFinite(slotIndex)) return;

    const wasInRoundShuffle = this.roundMovableIndices.has(slotIndex);
    const lockedByRound = !wasInRoundShuffle;
    const isSolved = this.slotChunkIds[slotIndex] === slotIndex;
    const canDrag = !lockedByRound && !isSolved;
    if (!canDrag) return;

    window.getSelection()?.removeAllRanges();

    const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
    this.clearPending();
    this.pending = {
      pointerId: event.pointerId,
      slotIndex,
      startX: event.clientX,
      startY: event.clientY,
      touchLike,
      timer: touchLike
        ? setTimeout(() => {
            const pend = this.pending;
            if (!pend) return;
            this.beginPointerDrag(pend.slotIndex, pend.pointerId);
          }, POINTER_REORDER_TOUCH_DELAY_MS)
        : null,
    };
    this.attachDocumentPointerTracking();
  }

  onDragStart(event: DragEvent, slotIndex: number): void {
    if (this.slotChunkIds[slotIndex] === slotIndex) {
      event.preventDefault();
      return;
    }
    this.draggedSlot = slotIndex;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', String(slotIndex));
      } catch {
        // ignore
      }
    }
    const target = event.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });
    this.attachDocumentDragScroll();
    this.cdr.markForCheck();
  }

  onDragOver(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverSlot = slotIndex;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.dragOverSlot = null;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent, dst: number): void {
    event.preventDefault();
    const src = this.draggedSlot;
    this.draggedSlot = null;
    this.dragOverSlot = null;
    this.detachDocumentDragScroll();
    if (src === null || src === dst) {
      this.cdr.markForCheck();
      return;
    }
    if (this.slotChunkIds[dst] === dst) {
      this.invalidDrop.emit();
      this.cdr.markForCheck();
      return;
    }
    this.applySwap(src, dst, this.slotChunkIds);
    this.cdr.markForCheck();
  }

  onDragEnd(): void {
    this.draggedSlot = null;
    this.dragOverSlot = null;
    this.detachDocumentDragScroll();
    this.cdr.markForCheck();
  }

  private detectPointerPath(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.mediaQuery = window.matchMedia('(hover: none), (any-pointer: coarse)');
    this.mediaQueryHandler = () => {
      const touchCapable =
        this.mediaQuery!.matches ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
      this.usePointerPath = touchCapable;
      this.cdr.markForCheck();
    };
    this.mediaQueryHandler();
    this.mediaQuery.addEventListener('change', this.mediaQueryHandler);
  }

  private applySwap(src: number, dst: number, current: number[]): void {
    if (src === dst) return;
    if (current[dst] === dst) {
      this.invalidDrop.emit();
      return;
    }
    const prev = current;
    const next = [...prev];
    [next[src], next[dst]] = [next[dst]!, next[src]!];
    const became: number[] = [];
    for (let i = 0; i < next.length; i++) {
      if (next[i] === i && prev[i] !== i) became.push(i);
    }
    this.slotChunkIdsChange.emit(next);
    if (became.length > 0) this.slotsBecameCorrect.emit(became);
  }

  private clearPending(): void {
    if (this.pending?.timer != null) clearTimeout(this.pending.timer);
    this.pending = null;
  }

  private updatePointerDragLabel(): void {
    if (this.draggedSlot === null) {
      this.pointerDragLabel = '';
      return;
    }
    const slotIndex = this.draggedSlot;
    const chunkId = this.slotChunkIds[slotIndex] ?? slotIndex;
    const chunk = this.chunks[chunkId];
    const text = chunk?.text ?? '';
    const showHoldPeek =
      this.holdHintPeekFirstWrong &&
      this.firstWrongSlotIndex === slotIndex &&
      this.slotChunkIds[slotIndex] !== slotIndex;
    const peekText = this.chunks[slotIndex]?.text ?? '';
    this.pointerDragLabel = showHoldPeek ? peekText : text;
  }

  private beginPointerDrag(slotIndex: number, pointerId: number): void {
    this.clearPending();
    const root = this.listRef?.nativeElement;
    if (!root) return;
    const li = root.querySelector(`[data-reorder-slot="${slotIndex}"]`);
    if (!(li instanceof HTMLElement)) return;
    try {
      li.setPointerCapture(pointerId);
    } catch {
      // capture unsupported
    }
    this.activeDragPointerId = pointerId;
    this.draggedSlot = slotIndex;
    window.getSelection()?.removeAllRanges();
    const r = li.getBoundingClientRect();
    this.pointerDragPreview = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.updatePointerDragLabel();
    requestAnimationFrame(() => {
      li.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });
    this.cdr.markForCheck();
  }

  private endPointerDragGesture(): void {
    this.activeDragPointerId = null;
    this.draggedSlot = null;
    this.dragOverSlot = null;
    this.pointerDragPreview = null;
    this.pointerDragLabel = '';
    this.cdr.markForCheck();
  }

  private commitPointerDrop(clientX: number, clientY: number): void {
    const src = this.draggedSlot;
    const root = this.listRef?.nativeElement;
    if (src === null || !root) {
      this.endPointerDragGesture();
      return;
    }
    const li = root.querySelector(`[data-reorder-slot="${src}"]`);
    const pid = this.activeDragPointerId;
    if (li instanceof HTMLElement && pid != null) {
      try {
        if (li.hasPointerCapture(pid)) li.releasePointerCapture(pid);
      } catch {
        // ignore
      }
    }

    const dst = this.dragOverSlot ?? slotIndexUnderPointer(root, clientX, clientY) ?? src;
    const current = [...this.slotChunkIds];
    this.endPointerDragGesture();

    if (src === dst) return;
    if (current[dst] === dst) {
      this.invalidDrop.emit();
      return;
    }
    this.applySwap(src, dst, current);
  }

  private attachDocumentPointerTracking(): void {
    this.purgePointerListeners?.();
    const scrollEl = this.scrollParentRef;
    const EDGE_PX = 56;
    const STEP_PX = 16;

    const onMove = (ev: PointerEvent): void => {
      const pending = this.pending;
      if (pending && ev.pointerId === pending.pointerId && this.draggedSlot === null) {
        const dx = ev.clientX - pending.startX;
        const dy = ev.clientY - pending.startY;
        const dist = Math.hypot(dx, dy);
        if (!pending.touchLike && dist > POINTER_REORDER_MOUSE_MOVE_THRESHOLD_PX) {
          const slot = pending.slotIndex;
          const pid = pending.pointerId;
          if (pending.timer != null) clearTimeout(pending.timer);
          this.pending = null;
          this.beginPointerDrag(slot, pid);
        }
        return;
      }

      if (ev.pointerId !== this.activeDragPointerId) return;
      ev.preventDefault();
      this.pointerDragPreview = { x: ev.clientX, y: ev.clientY };
      const root = this.listRef?.nativeElement;
      if (root) {
        const over = slotIndexUnderPointer(root, ev.clientX, ev.clientY);
        if (over != null) {
          this.dragOverSlot = over;
          this.cdr.markForCheck();
        }
      }
      if (scrollEl) {
        const r = scrollEl.getBoundingClientRect();
        if (ev.clientY < r.top + EDGE_PX) {
          scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - STEP_PX);
        } else if (ev.clientY > r.bottom - EDGE_PX) {
          const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
          scrollEl.scrollTop = Math.min(maxScroll, scrollEl.scrollTop + STEP_PX);
        }
      }
    };

    const onUpOrCancel = (ev: PointerEvent): void => {
      if (this.pending && ev.pointerId === this.pending.pointerId) {
        this.purgePointerListeners?.();
        this.purgePointerListeners = null;
        this.clearPending();
        return;
      }
      if (ev.pointerId !== this.activeDragPointerId) return;
      this.purgePointerListeners?.();
      this.purgePointerListeners = null;
      this.commitPointerDrop(ev.clientX, ev.clientY);
    };

    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUpOrCancel, { capture: true });
    document.addEventListener('pointercancel', onUpOrCancel, { capture: true });
    this.purgePointerListeners = () => {
      document.removeEventListener('pointermove', onMove, { capture: true });
      document.removeEventListener('pointerup', onUpOrCancel, { capture: true });
      document.removeEventListener('pointercancel', onUpOrCancel, { capture: true });
    };
  }

  private attachDocumentDragScroll(): void {
    if (this.usePointerPath || this.documentDragOverHandler) return;
    const scrollEl = this.scrollParentRef;
    if (!scrollEl) return;
    const EDGE_PX = 56;
    const STEP_PX = 16;
    this.documentDragOverHandler = (ev: DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      const r = scrollEl.getBoundingClientRect();
      if (ev.clientY < r.top + EDGE_PX) {
        scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - STEP_PX);
      } else if (ev.clientY > r.bottom - EDGE_PX) {
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
        scrollEl.scrollTop = Math.min(maxScroll, scrollEl.scrollTop + STEP_PX);
      }
    };
    document.addEventListener('dragover', this.documentDragOverHandler);
  }

  private detachDocumentDragScroll(): void {
    if (this.documentDragOverHandler) {
      document.removeEventListener('dragover', this.documentDragOverHandler);
      this.documentDragOverHandler = null;
    }
  }
}
