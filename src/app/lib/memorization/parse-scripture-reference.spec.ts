import { describe, it, expect } from 'vitest';
import {
  buildVerseRangeReferenceFromChapter,
  buildVerseReferenceFromChapter,
  isChapterOnlyScriptureReference,
  isSingleChapterBookChapterOneReference,
  isSingleVerseScriptureReference,
  parseReference,
  scriptureChapterReferenceKey,
  scriptureReferenceForPassageQuery,
  singleChapterBookVerseCount,
  splitScriptureReferenceDisplay,
} from './parse-scripture-reference';

describe('parse-scripture-reference', () => {
  it('parseReference handles verse, range, and chapter-only refs', () => {
    expect(parseReference('John 3:16')).toEqual({
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
    expect(parseReference('Genesis 1:1-3')).toEqual({
      book: 'Genesis',
      chapter: 1,
      verseStart: 1,
      verseEnd: 3,
    });
    expect(parseReference('Psalm 23')).toEqual({
      book: 'Psalm',
      chapter: 23,
      verseStart: null,
      verseEnd: null,
    });
    expect(parseReference('Isaiah 40:25–26')?.verseEnd).toBe(26);
    expect(parseReference('John 3:16a')?.verseStart).toBe(16);
    expect(parseReference('not a ref')).toBeNull();
  });

  it('isChapterOnlyScriptureReference', () => {
    expect(isChapterOnlyScriptureReference('Genesis 1')).toBe(true);
    expect(isChapterOnlyScriptureReference('Genesis 1:1')).toBe(false);
  });

  it('isSingleVerseScriptureReference', () => {
    expect(isSingleVerseScriptureReference('John 3:16')).toBe(true);
    expect(isSingleVerseScriptureReference('John 3:16-18')).toBe(false);
    expect(isSingleVerseScriptureReference('Psalm 23')).toBe(false);
  });

  it('builds verse references from chapter refs', () => {
    expect(buildVerseReferenceFromChapter('Genesis 1', 16)).toBe('Genesis 1:16');
    expect(buildVerseRangeReferenceFromChapter('Genesis 1', 3, 5)).toBe('Genesis 1:3-5');
    expect(buildVerseRangeReferenceFromChapter('bad', 1, null)).toBeNull();
  });

  it('scriptureChapterReferenceKey normalizes book casing', () => {
    expect(scriptureChapterReferenceKey('  Genesis   1 ')).toBe('genesis|1');
  });

  it('expands single-chapter book chapter-one refs for passage query', () => {
    expect(isSingleChapterBookChapterOneReference('Jude 1')).toBe(true);
    expect(isSingleChapterBookChapterOneReference('Genesis 1')).toBe(false);
    expect(scriptureReferenceForPassageQuery('Jude 1')).toMatch(/^Jude 1:1-/);
    expect(singleChapterBookVerseCount('Jude')).toBeGreaterThan(0);
  });
});

describe('splitScriptureReferenceDisplay', () => {
  it('splits book from verse citation', () => {
    expect(splitScriptureReferenceDisplay('John 3:16')).toEqual({
      book: 'John',
      citation: '3:16',
    });
  });

  it('splits numbered books and ranges', () => {
    expect(splitScriptureReferenceDisplay('1 Thessalonians 5:16-18')).toEqual({
      book: '1 Thessalonians',
      citation: '5:16-18',
    });
  });

  it('splits chapter-only references', () => {
    expect(splitScriptureReferenceDisplay('Psalm 23')).toEqual({
      book: 'Psalm',
      citation: '23',
    });
  });

  it('returns whole label for non-verse references', () => {
    expect(splitScriptureReferenceDisplay('Bible Books (OT)')).toEqual({
      book: 'Bible Books (OT)',
      citation: null,
    });
  });
});
