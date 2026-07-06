/** Display book name from canon id (Prayer App uses static canon names). */
export function referenceBookNameFromApiBook(
  _bookId: string,
  bookName: string
): string {
  return bookName.trim();
}

const BOOK_ORDINAL_WORDS: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
};

export function bibleBookNameToSpeechText(bookName: string): string {
  const trimmed = bookName.trim();
  const numbered = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!numbered) return trimmed;
  const ordinal = BOOK_ORDINAL_WORDS[Number.parseInt(numbered[1]!, 10)];
  if (!ordinal) return trimmed;
  return `${ordinal} ${numbered[2]!}`;
}
