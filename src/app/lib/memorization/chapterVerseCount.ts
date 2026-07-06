import { BIBLE_CANON_BOOKS_STATIC } from './bibleCanonStatic';
import { parseReference } from './parse-scripture-reference';

export function maxVerseNumberInChapterText(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max;
}

/** Verse count for a chapter reference from static canon. */
export function verseCountForChapterReference(
  chapterReference: string,
  chapterText?: string
): number {
  const parsed = parseReference(chapterReference.trim());
  if (parsed) {
    const book = BIBLE_CANON_BOOKS_STATIC.find(
      (b) => b.name.toLowerCase() === parsed.book.toLowerCase()
    );
    if (book) {
      const count = book.versesPerChapter[parsed.chapter - 1];
      if (typeof count === 'number' && count > 0) return count;
    }
  }
  if (chapterText) {
    const fromText = maxVerseNumberInChapterText(chapterText);
    if (fromText > 0) return fromText;
  }
  return 0;
}
