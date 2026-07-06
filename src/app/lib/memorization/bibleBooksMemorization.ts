import { BIBLE_BOOKS_PUBLIC } from './bibleCanonPublic'
import type { BibleBookPublic } from './bible-structure-types'
import type { MemorizedItem } from '../../types/memorization';

export type BibleBooksMemorizationScope = 'all' | 'ot' | 'nt';

export function isBibleBooksMemorizationItem(
  item: MemorizedItem
): item is MemorizedItem & { kind: 'bibleBooks'; bibleBooksScope: BibleBooksMemorizationScope } {
  return item.kind === 'bibleBooks' && item.bibleBooksScope != null;
}

export function booksForScope(scope: BibleBooksMemorizationScope): BibleBookPublic[] {
  if (scope === 'all') return BIBLE_BOOKS_PUBLIC
  return BIBLE_BOOKS_PUBLIC.filter((b) => b.testament === scope)
}

export function bibleBooksPlainText(scope: BibleBooksMemorizationScope): string {
  return booksForScope(scope)
    .map((b) => b.name)
    .join(' ')
}

export function bibleBooksReferenceLabel(scope: BibleBooksMemorizationScope): string {
  if (scope === 'ot') return 'Bible Books (OT)'
  if (scope === 'nt') return 'Bible Books (NT)'
  return 'Bible Books'
}

export function bibleBooksCountLabel(scope: BibleBooksMemorizationScope): string {
  const count = booksForScope(scope).length
  return `${count} book${count === 1 ? '' : 's'}`
}

/** Testament tabs to show in the book-list UI for a given scope. */
export function bibleBooksTestamentsForScope(
  scope: BibleBooksMemorizationScope
): Array<'ot' | 'nt'> {
  if (scope === 'ot') return ['ot']
  if (scope === 'nt') return ['nt']
  return ['ot', 'nt']
}
