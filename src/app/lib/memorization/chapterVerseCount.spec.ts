import { describe, it, expect } from 'vitest';
import {
  maxVerseNumberInChapterText,
  verseCountForChapterReference,
} from './chapterVerseCount';

describe('chapterVerseCount', () => {
  it('maxVerseNumberInChapterText parses bracketed verse numbers', () => {
    expect(maxVerseNumberInChapterText('Hello [1] world [12] end [3]')).toBe(12);
  });

  it('verseCountForChapterReference uses static canon when possible', () => {
    expect(verseCountForChapterReference('Genesis 1')).toBe(31);
  });

  it('verseCountForChapterReference falls back to chapter text', () => {
    expect(verseCountForChapterReference('Unknown 1', '[1] [2] [3]')).toBe(3);
  });
});
