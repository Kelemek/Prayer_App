import { describe, it, expect } from 'vitest';
import {
  adjacentChapterPassage,
  adjacentPickerPassage,
  pickerAdjacentOpensInChapterView,
  pickerPassageHasNext,
  pickerPassageHasPrevious,
} from './biblePassagePickerNavigation';

describe('biblePassagePickerNavigation', () => {
  it('pickerAdjacentOpensInChapterView respects flag and chapter-only refs', () => {
    expect(
      pickerAdjacentOpensInChapterView({ reference: 'John 3:16', initialChapterView: false })
    ).toBe(false);
    expect(
      pickerAdjacentOpensInChapterView({ reference: 'John 3', initialChapterView: false })
    ).toBe(true);
  });

  it('navigates adjacent verses within a chapter', () => {
    const next = adjacentPickerPassage('John 3:16', 'next');
    expect(next?.reference).toBe('John 3:17');
    const prev = adjacentPickerPassage('John 3:16', 'prev');
    expect(prev?.reference).toBe('John 3:15');
  });

  it('navigates adjacent chapters for chapter-only refs', () => {
    expect(adjacentPickerPassage('John 3', 'next')?.reference).toBe('John 4');
    expect(adjacentChapterPassage('Acts 20:28', 'next')).toBe('Acts 21');
  });

  it('reports whether previous/next exist', () => {
    expect(pickerPassageHasPrevious('Genesis 1:1')).toBe(false);
    expect(pickerPassageHasNext('John 3:16')).toBe(true);
    expect(pickerPassageHasNext('Revelation 22:21')).toBe(false);
  });

  it('returns null for invalid references', () => {
    expect(adjacentPickerPassage('Not A Book 1:1', 'next')).toBeNull();
    expect(adjacentChapterPassage('Unknown 1:1', 'next')).toBeNull();
  });

  it('moves to last verse of previous chapter at chapter start', () => {
    const prev = adjacentPickerPassage('John 2:1', 'prev');
    expect(prev?.reference).toMatch(/John 1/);
    expect(prev?.initialChapterView).toBe(false);
  });

  it('advances verse ranges from the range end', () => {
    const next = adjacentPickerPassage('John 3:16-18', 'next');
    expect(next?.reference).toBe('John 3:19');
  });
});
