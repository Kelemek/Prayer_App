import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BiblePassagePickerModalComponent } from './bible-passage-picker-modal.component';
import { MemorizationService } from '../../services/memorization.service';
import { BIBLE_BOOKS_PUBLIC } from '../../lib/memorization/bibleCanonPublic';

const mockMemorization = {
  getPreferredTranslation: vi.fn(() => 'esv' as const),
};

function createModal(): BiblePassagePickerModalComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BiblePassagePickerModalComponent],
    providers: [{ provide: MemorizationService, useValue: mockMemorization }],
  });
  return TestBed.createComponent(BiblePassagePickerModalComponent).componentInstance;
}

describe('BiblePassagePickerModalComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMemorization.getPreferredTranslation.mockReturnValue('esv');
    localStorage.clear();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  it('filters books by testament', () => {
    const modal = createModal();
    modal.testament = 'ot';
    expect(modal.filteredBooks.every((b) => b.testament === 'ot')).toBe(true);
    modal.setTestament('nt');
    expect(modal.filteredBooks.every((b) => b.testament === 'nt')).toBe(true);
    expect(localStorage.getItem('prayer_app_memorize_add_testament')).toBe('nt');
  });

  it('reads saved testament from localStorage on open', () => {
    localStorage.setItem('prayer_app_memorize_add_testament', 'nt');
    const modal = createModal();
    modal.isOpen = true;
    modal.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    expect(modal.testament).toBe('nt');
    expect(mockMemorization.getPreferredTranslation).toHaveBeenCalled();
  });

  it('locks and unlocks background scroll when opened and closed', () => {
    const modal = createModal();
    modal.isOpen = true;
    modal.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    modal.isOpen = false;
    modal.ngOnChanges({
      isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
    });
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('toggleBook expands and collapses books', () => {
    const modal = createModal();
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    modal.toggleBook(john);
    expect(modal.expandedBookId).toBe('JHN');
    modal.toggleBook(john);
    expect(modal.expandedBookId).toBeNull();
  });

  it('onChapterClick selects chapter and builds verse numbers', () => {
    const modal = createModal();
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    const chapter = john.chapters.find((c) => c.number === '3')!;
    modal.onChapterClick(john, chapter.id, 3);
    expect(modal.selectedBookId).toBe('JHN');
    expect(modal.selectedChapterId).toBe(chapter.id);
    expect(modal.verseNumbers.length).toBeGreaterThan(0);
    expect(modal.canConfirm).toBe(true);
  });

  it('onVerseClick selects single verse and ranges', () => {
    const modal = createModal();
    modal.onVerseClick(3);
    expect(modal.inRange(3)).toBe(true);
    modal.onVerseClick(7);
    expect(modal.inRange(5)).toBe(true);
    expect(modal.inRange(8)).toBe(false);
    modal.onVerseClick(3);
    expect(modal.inRange(3)).toBe(true);
    expect(modal.inRange(7)).toBe(false);
    modal.onVerseClick(2);
    modal.onVerseClick(4);
    modal.onVerseClick(9);
    expect(modal.inRange(9)).toBe(true);
    expect(modal.inRange(2)).toBe(false);
  });

  it('confirm emits reference for chapter-only selection', () => {
    const modal = createModal();
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    const chapter = john.chapters.find((c) => c.number === '3')!;
    modal.onChapterClick(john, chapter.id, 3);
    const confirmed = vi.fn();
    modal.confirmed.subscribe(confirmed);
    modal.confirm();
    expect(confirmed).toHaveBeenCalledWith('John 3');
  });

  it('confirm emits reference with verse range', () => {
    const modal = createModal();
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    const chapter = john.chapters.find((c) => c.number === '3')!;
    modal.onChapterClick(john, chapter.id, 3);
    modal.onVerseClick(16);
    modal.onVerseClick(18);
    const confirmed = vi.fn();
    modal.confirmed.subscribe(confirmed);
    modal.confirm();
    expect(confirmed).toHaveBeenCalledWith('John 3:16-18');
  });

  it('confirm does nothing when busy or incomplete selection', () => {
    const modal = createModal();
    const confirmed = vi.fn();
    modal.confirmed.subscribe(confirmed);
    modal.confirm();
    expect(confirmed).not.toHaveBeenCalled();

    modal.busy = true;
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    const chapter = john.chapters[0];
    modal.onChapterClick(john, chapter.id, 1);
    modal.confirm();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('onTranslationChanged updates translation and emits', () => {
    const modal = createModal();
    const translationChange = vi.fn();
    modal.translationChange.subscribe(translationChange);
    modal.onTranslationChanged('niv');
    expect(modal.translation).toBe('niv');
    expect(translationChange).toHaveBeenCalledWith('niv');
  });

  it('onEscape closes modal unless translation dropdown is open', () => {
    const modal = createModal();
    modal.isOpen = true;
    const close = vi.fn();
    modal.close.subscribe(close);
    modal.onEscape();
    expect(close).toHaveBeenCalled();

    close.mockClear();
    modal.translationPicker = { isDropdownOpen: true, closeDropdown: vi.fn() } as any;
    modal.onEscape();
    expect(close).not.toHaveBeenCalled();
    expect(modal.translationPicker?.closeDropdown).toHaveBeenCalled();
  });

  it('sortedChapters returns chapters in numeric order', () => {
    const modal = createModal();
    const john = BIBLE_BOOKS_PUBLIC.find((b) => b.id === 'JHN')!;
    const sorted = modal.sortedChapters(john);
    expect(+sorted[0].number).toBeLessThan(+sorted[1].number);
  });

  it('ngOnDestroy removes touch listener and unlocks scroll', () => {
    const modal = createModal();
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    modal.isOpen = true;
    modal.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    });
    modal.ngOnDestroy();
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
