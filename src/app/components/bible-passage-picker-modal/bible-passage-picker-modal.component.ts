import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BIBLE_BOOKS_PUBLIC } from '../../lib/memorization/bibleCanonPublic';
import { buildBiblePassageReference } from '../../lib/memorization/buildBiblePassageReference';
import type { BibleBookPublic } from '../../lib/memorization/bible-structure-types';
import { MemorizationService } from '../../services/memorization.service';
import {
  BIBLE_TRANSLATION_CODES,
  BIBLE_TRANSLATION_LABELS,
  type BibleTranslation,
} from '../../types/memorization';

type Testament = 'ot' | 'nt';

const TESTAMENT_KEY = 'prayer_app_memorize_add_testament';

@Component({
  selector: 'app-bible-passage-picker-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-2 sm:p-4"
      style="padding-top: max(8px, env(safe-area-inset-top)); padding-bottom: max(8px, env(safe-area-inset-bottom));"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bible-passage-picker-title"
      (click)="close.emit()"
    >
      <div
        class="w-full max-w-lg max-h-[min(92vh,720px)] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="bible-passage-picker-title" class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {{ selectedChapterNum ? 'Pick Verse Range' : 'Pick Chapter' }}
          </h2>
          <button
            type="button"
            (click)="close.emit()"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 cursor-pointer"
            aria-label="Close"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 min-h-0 flex flex-col px-4 sm:px-6 py-4 overflow-hidden">
          <div class="shrink-0 mb-3">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Bible translation
            </p>
            <div class="relative">
              <div
                class="overflow-hidden rounded-lg border bg-white dark:bg-gray-800 transition-all"
                [class.border-blue-500]="showTranslationDropdown"
                [class.ring-1]="showTranslationDropdown"
                [class.ring-blue-500/30]="showTranslationDropdown"
                [class.dark:border-blue-400]="showTranslationDropdown"
                [class.border-gray-300]="!showTranslationDropdown"
                [class.dark:border-gray-600]="!showTranslationDropdown"
              >
                <button
                  type="button"
                  id="bible-translation-picker-trigger"
                  (click)="toggleTranslationDropdown()"
                  [attr.aria-expanded]="showTranslationDropdown"
                  aria-haspopup="listbox"
                  aria-label="Preferred Bible translation for memorization"
                  class="flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
                >
                  <span class="font-medium text-gray-800 dark:text-gray-100">
                    {{ selectedTranslationLabel }}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="shrink-0 text-gray-500 transition-transform dark:text-gray-400"
                    [class.rotate-180]="showTranslationDropdown"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              @if (showTranslationDropdown) {
              <div
                class="fixed inset-0 z-[101]"
                (click)="closeTranslationDropdown()"
              ></div>
              <div
                role="listbox"
                aria-label="Bible translation options"
                class="absolute left-0 right-0 z-[102] mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
              >
                @for (code of translationCodes; track code) {
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="translation === code"
                  (click)="setTranslation(code)"
                  class="flex w-full min-h-[44px] cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60 touch-manipulation"
                  [class.bg-blue-50]="translation === code"
                  [class.dark:bg-blue-900/30]="translation === code"
                >
                  <span>{{ translationLabels[code] }}</span>
                  @if (translation === code) {
                  <span class="ml-2 shrink-0 text-blue-600 dark:text-blue-400">✓</span>
                  }
                </button>
                }
              </div>
              }
            </div>
          </div>

          <div
            class="shrink-0 flex gap-2 mb-3"
            role="tablist"
            aria-label="Testament"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="testament === 'ot'"
              (click)="setTestament('ot')"
              class="flex-1 px-4 py-2.5 text-sm rounded-lg font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
              [class]="testament === 'ot'
                ? 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500'"
            >
              Old Testament
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="testament === 'nt'"
              (click)="setTestament('nt')"
              class="flex-1 px-4 py-2.5 text-sm rounded-lg font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
              [class]="testament === 'nt'
                ? 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500'"
            >
              New Testament
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            @for (book of filteredBooks; track book.id) {
            <div class="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <button
                type="button"
                (click)="toggleBook(book)"
                class="w-full flex items-center justify-between px-3 py-3 min-h-[44px] text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer touch-manipulation"
              >
                {{ book.name }}
                <span class="text-gray-400">{{ expandedBookId === book.id ? '▾' : '▸' }}</span>
              </button>
              @if (expandedBookId === book.id) {
              <div class="px-3 pb-3 grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
                @for (ch of book.chapters; track ch.id) {
                <button
                  type="button"
                  (click)="onChapterClick(book, ch.id, +ch.number)"
                  class="w-full min-h-[44px] px-2 py-2 text-sm rounded-lg border cursor-pointer transition-colors inline-flex items-center justify-center touch-manipulation"
                  [class]="selectedChapterId === ch.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
                >
                  {{ ch.number }}
                </button>
                }
              </div>
              }
            </div>
            }
          </div>

          @if (verseCount && verseCount > 0) {
          <div class="shrink-0 mt-3">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Select verse(s)</p>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2 max-h-40 overflow-y-auto">
              @for (n of verseNumbers; track n) {
              <button
                type="button"
                (click)="onVerseClick(n)"
                class="w-full min-h-[44px] px-2 py-2 text-sm rounded-lg border cursor-pointer transition-colors inline-flex items-center justify-center touch-manipulation"
                [class]="inRange(n) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                {{ n }}
              </button>
              }
            </div>
          </div>
          }

          <div class="shrink-0 pt-4">
            <button
              type="button"
              [disabled]="!canConfirm || submitting"
              (click)="confirm()"
              class="w-full py-2.5 rounded-lg font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 disabled:hover:bg-blue-100 dark:disabled:hover:bg-blue-900/40 disabled:hover:border-blue-200 dark:disabled:hover:border-blue-700"
            >
              {{ submitting ? 'Adding…' : confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
    }
  `,
})
export class BiblePassagePickerModalComponent implements OnChanges {
  private readonly memorization = inject(MemorizationService);

  @Input() isOpen = false;
  @Input() confirmLabel = 'Add';
  @Output() close = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<string>();
  @Output() translationChange = new EventEmitter<BibleTranslation>();

  readonly translationCodes = BIBLE_TRANSLATION_CODES;
  readonly translationLabels = BIBLE_TRANSLATION_LABELS;
  translation: BibleTranslation = 'esv';
  showTranslationDropdown = false;

  testament: Testament = 'ot';
  expandedBookId: string | null = null;
  selectedChapterId: string | null = null;
  selectedChapterNum: number | null = null;
  selectedBookId: string | null = null;
  selectedBookName = '';
  verseCount: number | null = null;
  verseStart: number | null = null;
  verseEnd: number | null = null;
  submitting = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.translation = this.memorization.getPreferredTranslation();
      this.showTranslationDropdown = false;
      this.testament = this.readTestament();
      this.resetSelection();
      this.expandedBookId = null;
    }
  }

  get filteredBooks(): BibleBookPublic[] {
    return BIBLE_BOOKS_PUBLIC.filter((b) => b.testament === this.testament);
  }

  get verseNumbers(): number[] {
    if (!this.verseCount || this.verseCount <= 0) return [];
    return Array.from({ length: this.verseCount }, (_, i) => i + 1);
  }

  get canConfirm(): boolean {
    return (
      this.selectedBookId !== null &&
      this.selectedChapterNum !== null &&
      this.verseStart !== null &&
      !this.submitting &&
      this.verseCount !== null &&
      this.verseCount > 0
    );
  }

  get selectedTranslationLabel(): string {
    return this.translationLabels[this.translation];
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isOpen) return;
    if (this.showTranslationDropdown) {
      this.closeTranslationDropdown();
      return;
    }
    this.close.emit();
  }

  toggleTranslationDropdown(): void {
    this.showTranslationDropdown = !this.showTranslationDropdown;
  }

  closeTranslationDropdown(): void {
    this.showTranslationDropdown = false;
  }

  setTranslation(next: BibleTranslation): void {
    this.closeTranslationDropdown();
    if (this.translation === next) return;
    this.translation = next;
    this.memorization.setPreferredTranslation(next);
    this.translationChange.emit(next);
  }

  setTestament(next: Testament): void {
    this.testament = next;
    try {
      localStorage.setItem(TESTAMENT_KEY, next);
    } catch {
      /* ignore */
    }
    this.expandedBookId = null;
    this.resetSelection();
  }

  toggleBook(book: BibleBookPublic): void {
    this.expandedBookId = this.expandedBookId === book.id ? null : book.id;
  }

  onChapterClick(book: BibleBookPublic, chapterId: string, chapterNumber: number): void {
    const ch = book.chapters.find((c) => c.id === chapterId);
    this.selectedBookId = book.id;
    this.selectedBookName = book.name;
    this.selectedChapterId = chapterId;
    this.selectedChapterNum = chapterNumber;
    this.verseStart = null;
    this.verseEnd = null;
    this.verseCount = typeof ch?.verseCount === 'number' ? ch.verseCount : 0;
  }

  onVerseClick(v: number): void {
    if (this.verseStart === null) {
      this.verseStart = v;
      this.verseEnd = null;
      return;
    }
    if (this.verseEnd === null) {
      if (v === this.verseStart) return;
      const lo = Math.min(v, this.verseStart);
      const hi = Math.max(v, this.verseStart);
      this.verseStart = lo;
      this.verseEnd = hi;
      return;
    }
    this.verseStart = v;
    this.verseEnd = null;
  }

  inRange(n: number): boolean {
    if (this.verseStart === null) return false;
    if (this.verseEnd === null) return n === this.verseStart;
    const lo = Math.min(this.verseStart, this.verseEnd);
    const hi = Math.max(this.verseStart, this.verseEnd);
    return n >= lo && n <= hi;
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm || this.selectedBookId === null || this.selectedChapterNum === null) return;
    const ref = buildBiblePassageReference(
      this.selectedBookId,
      this.selectedBookName,
      this.selectedChapterNum,
      this.verseStart,
      this.verseEnd
    );
    this.submitting = true;
    try {
      this.confirmed.emit(ref);
    } finally {
      this.submitting = false;
    }
  }

  private resetSelection(): void {
    this.selectedChapterId = null;
    this.selectedChapterNum = null;
    this.selectedBookId = null;
    this.selectedBookName = '';
    this.verseCount = null;
    this.verseStart = null;
    this.verseEnd = null;
  }

  private readTestament(): Testament {
    try {
      const v = localStorage.getItem(TESTAMENT_KEY);
      if (v === 'ot' || v === 'nt') return v;
    } catch {
      /* ignore */
    }
    return 'ot';
  }
}
