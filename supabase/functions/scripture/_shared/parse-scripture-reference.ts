/** Verse count for Protestant one-chapter books (Obadiah, Philemon, 2–3 John, Jude). */
const SINGLE_CHAPTER_BOOK_VERSES = new Map<string, number>([
  ['obadiah', 21],
  ['philemon', 25],
  ['2 john', 13],
  ['3 john', 15],
  ['jude', 25],
]);

/**
 * Parse a scripture reference into components (shared by ESV and API.Bible paths).
 */
export function parseReference(
  reference: string
): { book: string; chapter: number; verseStart: number | null; verseEnd: number | null } | null {
  const normalized = reference.replace(/–/g, '-').replace(/(\d+)[a-z]+/g, '$1');

  const match = normalized.match(/^(.+?)\s+(\d+)(?::\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!match) return null;

  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verseStart: match[3] ? parseInt(match[3], 10) : null,
    verseEnd: match[4] ? parseInt(match[4], 10) : null,
  };
}

function singleChapterBookVerseCount(book: string): number | null {
  return SINGLE_CHAPTER_BOOK_VERSES.get(book.trim().toLowerCase()) ?? null;
}

function isSingleChapterBookChapterOneReference(reference: string): boolean {
  const parsed = parseReference(reference.trim());
  if (!parsed || parsed.verseStart !== null) return false;
  if (parsed.chapter !== 1) return false;
  return singleChapterBookVerseCount(parsed.book) != null;
}

/**
 * Expand one-chapter book refs like `Obadiah 1` to `Obadiah 1:1-21` for passage providers.
 */
export function scriptureReferenceForPassageQuery(reference: string): string {
  const trimmed = reference.trim();
  if (!isSingleChapterBookChapterOneReference(trimmed)) return trimmed;
  const parsed = parseReference(trimmed);
  if (!parsed) return trimmed;
  const lastVerse = singleChapterBookVerseCount(parsed.book);
  if (lastVerse == null) return trimmed;
  return `${parsed.book} 1:1-${lastVerse}`;
}
