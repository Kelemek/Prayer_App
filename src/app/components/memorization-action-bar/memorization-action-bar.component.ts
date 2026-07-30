import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

const ACTION_BTN_BASE =
  'flex flex-1 items-center justify-center whitespace-nowrap rounded-lg border px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer sm:flex-none sm:px-4';

/** Soft blue — matches verse picker primary actions (Verses default / picker tab selected). */
const SOFT_BLUE_BTN =
  'border-blue-200 bg-blue-100 text-blue-800 hover:border-blue-300 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:border-blue-600 dark:hover:bg-blue-900/60';

/**
 * Neutral at rest; hover/active snap to soft blue.
 * Dark hover uses `!` because theme `@utility` classes (e.g. bg-gray-800) set `!important`.
 */
const SECONDARY_BTN =
  'border-gray-300 bg-white text-gray-600 hover:!border-blue-200 hover:!bg-blue-100 hover:!text-blue-800 active:!border-blue-200 active:!bg-blue-100 active:!text-blue-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:!border-blue-700 dark:hover:!bg-blue-900/40 dark:hover:!text-blue-200 dark:active:!border-blue-700 dark:active:!bg-blue-900/40 dark:active:!text-blue-200';

@Component({
  selector: 'app-memorization-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-4 flex w-full gap-2">
      <button
        type="button"
        (click)="addVerses.emit()"
        [attr.aria-pressed]="addVersesActive"
        [class]="actionBtnBase + ' ' + softBlueBtn"
      >
        Verses
      </button>
      <button
        type="button"
        (click)="addBibleBooks.emit()"
        [attr.aria-pressed]="bibleBooksActive"
        [class]="actionBtnBase + ' ' + (bibleBooksActive ? softBlueBtn : secondaryBtn)"
      >
        Bible Books
      </button>
      @if (showRecommended) {
        <button
          type="button"
          (click)="openRecommended.emit()"
          [attr.aria-pressed]="recommendedActive"
          [class]="actionBtnBase + ' ' + (recommendedActive ? softBlueBtn : secondaryBtn)"
        >
          Recommended
        </button>
      }
    </div>
  `,
})
export class MemorizationActionBarComponent {
  @Input() showRecommended = false;
  @Input() addVersesActive = false;
  @Input() bibleBooksActive = false;
  @Input() recommendedActive = false;

  @Output() addVerses = new EventEmitter<void>();
  @Output() addBibleBooks = new EventEmitter<void>();
  @Output() openRecommended = new EventEmitter<void>();

  protected readonly actionBtnBase = ACTION_BTN_BASE;
  protected readonly softBlueBtn = SOFT_BLUE_BTN;
  protected readonly secondaryBtn = SECONDARY_BTN;
}
