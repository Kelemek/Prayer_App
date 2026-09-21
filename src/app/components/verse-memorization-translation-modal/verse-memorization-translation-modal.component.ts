import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BibleTranslationPickerComponent } from '../bible-translation-picker/bible-translation-picker.component';
import { MemorizationService } from '../../services/memorization.service';
import type { BibleTranslation } from '../../types/memorization';
import { AppTopChromeOverlayDirective } from '../../directives/app-top-chrome-overlay.directive';

@Component({
  selector: 'app-verse-memorization-translation-modal',
  standalone: true,
  imports: [CommonModule, BibleTranslationPickerComponent, AppTopChromeOverlayDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen) {
      <div
        appTopChromeOverlay
        class="fixed inset-0 bg-gray-900/50 flex items-start sm:items-center justify-center z-50 p-4 overscroll-none touch-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verse-memorization-translation-title"
        (click)="onCancel.emit()"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full flex flex-col modal-panel-edge touch-none"
          (click)="$event.stopPropagation()"
        >
          <div
            class="px-6 py-4 modal-chrome-header shrink-0 flex items-center justify-between gap-3 touch-none"
          >
            <h2
              id="verse-memorization-translation-title"
              class="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Choose Bible translation
            </h2>
            <button
              type="button"
              (click)="onCancel.emit()"
              class="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 cursor-pointer"
              aria-label="Close"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-6 py-4">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Memorize: {{ reference }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Pick the version you want to practice.
            </p>
            <app-bible-translation-picker
              [translation]="selectedTranslation"
              [escapeOverflowContainer]="true"
              triggerId="verse-memorization-translation-picker-trigger"
              triggerAriaLabel="Bible translation for verse memorization"
              (translationChange)="onTranslationChanged($event)"
            />
          </div>

          <div
            class="shrink-0 modal-chrome-footer px-6 py-4 touch-none"
          >
            <button
              type="button"
              (click)="onConfirm.emit(selectedTranslation)"
              class="w-full min-h-[48px] py-2.5 rounded-lg font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600"
            >
              Start memorizing
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class VerseMemorizationTranslationModalComponent implements OnChanges {
  private readonly memorization = inject(MemorizationService);

  @Input() isOpen = false;
  @Input() reference = '';
  @Input() suggestedTranslation: BibleTranslation | null = null;

  @Output() onConfirm = new EventEmitter<BibleTranslation>();
  @Output() onCancel = new EventEmitter<void>();

  selectedTranslation: BibleTranslation = 'esv';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.selectedTranslation =
        this.suggestedTranslation ?? this.memorization.getPreferredTranslation();
    }
  }

  onTranslationChanged(translation: BibleTranslation): void {
    this.selectedTranslation = translation;
  }
}
