import { describe, it, expect } from 'vitest';
import {
  EMPTY_VERSE_RANGE_SELECTION,
  formatVerseRangeSelectionLabel,
  isVerseInRange,
  nextVerseRangeSelection,
  verseNumbersInRange,
} from './bibleVerseRangeSelection';

describe('bibleVerseRangeSelection', () => {
  it('starts a range on first tap', () => {
    expect(nextVerseRangeSelection(EMPTY_VERSE_RANGE_SELECTION, 3)).toEqual({
      verseStart: 3,
      verseEnd: null,
    });
  });

  it('extends range on second tap', () => {
    const first = nextVerseRangeSelection(EMPTY_VERSE_RANGE_SELECTION, 5);
    expect(nextVerseRangeSelection(first, 8)).toEqual({
      verseStart: 5,
      verseEnd: 8,
    });
  });

  it('restarts range after a completed range', () => {
    const complete = { verseStart: 2, verseEnd: 4 };
    expect(nextVerseRangeSelection(complete, 7)).toEqual({
      verseStart: 7,
      verseEnd: null,
    });
  });

  it('isVerseInRange handles single-verse and multi-verse selections', () => {
    expect(isVerseInRange(3, { verseStart: 3, verseEnd: null })).toBe(true);
    expect(isVerseInRange(4, { verseStart: 3, verseEnd: null })).toBe(false);
    expect(isVerseInRange(4, { verseStart: 3, verseEnd: 6 })).toBe(true);
  });

  it('verseNumbersInRange expands inclusive range', () => {
    expect(verseNumbersInRange({ verseStart: 2, verseEnd: 4 })).toEqual([2, 3, 4]);
  });

  it('formatVerseRangeSelectionLabel formats labels', () => {
    expect(formatVerseRangeSelectionLabel({ verseStart: null, verseEnd: null })).toBeNull();
    expect(formatVerseRangeSelectionLabel({ verseStart: 2, verseEnd: null })).toBe('Verse 2');
    expect(formatVerseRangeSelectionLabel({ verseStart: 2, verseEnd: 5 })).toBe('Verses 2–5');
  });
});
