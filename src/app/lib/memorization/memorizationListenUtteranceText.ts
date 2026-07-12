import { booksForScope, isBibleBooksMemorizationItem } from './bibleBooksMemorization';
import { bibleBookNameToSpeechText } from './bible-reference-helpers';
import { getWordsForMemorization } from './memorizationPracticeUtils';
import type { MemorizedItem } from '../../types/memorization';

function normalizeReferenceForSpeech(ref: string): string {
  return ref
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .trim();
}

export function referenceToSpeechText(reference: string): string {
  const ref = normalizeReferenceForSpeech(reference);
  if (!ref) return '';

  const withBook = ref.match(
    /^(.+)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/i
  );
  if (withBook) {
    const book = withBook[1]!.trim();
    if (book.length > 0) {
      const bookSpeech = bibleBookNameToSpeechText(book);
      const ch = withBook[2]!;
      const v1 = withBook[3]!;
      const v2 = withBook[4];
      return v2
        ? `${bookSpeech} chapter ${ch}, verses ${v1} through ${v2}`
        : `${bookSpeech} chapter ${ch}, verse ${v1}`;
    }
  }

  const chapterOnly = ref.match(/^(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/i);
  if (chapterOnly) {
    const ch = chapterOnly[1]!;
    const v1 = chapterOnly[2]!;
    const v2 = chapterOnly[3];
    return v2
      ? `chapter ${ch}, verses ${v1} through ${v2}`
      : `chapter ${ch}, verse ${v1}`;
  }

  return ref.replace(/(\d+)\s*:\s*(\d+)/g, 'chapter $1, verse $2');
}

export function getMemorizationListenUtteranceText(
  item: MemorizedItem,
  passageText?: string
): string {
  const sourceText = passageText ?? item.text;
  const body = getWordsForMemorization(sourceText).join(' ');
  if (isBibleBooksMemorizationItem(item)) {
    return booksForScope(item.bibleBooksScope)
      .map((b) => bibleBookNameToSpeechText(b.name))
      .join(', ');
  }
  const spokenRef = referenceToSpeechText(item.reference);
  if (!body) return spokenRef;
  if (!spokenRef) return body;
  return `${body} ${spokenRef}`;
}
