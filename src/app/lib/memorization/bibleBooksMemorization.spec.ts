import { describe, it, expect } from 'vitest';
import {
  bibleBooksCountLabel,
  bibleBooksPlainText,
  bibleBooksReferenceLabel,
  bibleBooksTestamentsForScope,
  booksForScope,
  isBibleBooksMemorizationItem,
} from './bibleBooksMemorization';

describe('bibleBooksMemorization', () => {
  const bibleBooksItem = {
    kind: 'bibleBooks' as const,
    id: 'bb-1',
    bibleBooksScope: 'ot' as const,
  };

  it('identifies bible books memorization items', () => {
    expect(isBibleBooksMemorizationItem(bibleBooksItem)).toBe(true);
    expect(isBibleBooksMemorizationItem({ kind: 'verse', id: 'v1' } as any)).toBe(false);
  });

  it('filters books by scope', () => {
    expect(booksForScope('nt').every((b) => b.testament === 'nt')).toBe(true);
    expect(booksForScope('all').length).toBeGreaterThan(booksForScope('ot').length);
  });

  it('builds labels and plain text', () => {
    expect(bibleBooksReferenceLabel('ot')).toBe('Bible Books (OT)');
    expect(bibleBooksReferenceLabel('nt')).toBe('Bible Books (NT)');
    expect(bibleBooksReferenceLabel('all')).toBe('Bible Books');
    expect(bibleBooksCountLabel('nt')).toMatch(/books?/);
    expect(bibleBooksPlainText('nt').split(' ').length).toBeGreaterThan(1);
    expect(bibleBooksTestamentsForScope('all')).toEqual(['ot', 'nt']);
    expect(bibleBooksTestamentsForScope('ot')).toEqual(['ot']);
    expect(bibleBooksTestamentsForScope('nt')).toEqual(['nt']);
  });

  it('rejects items without a bible books scope', () => {
    expect(
      isBibleBooksMemorizationItem({ kind: 'bibleBooks', id: 'x', bibleBooksScope: null } as any)
    ).toBe(false);
  });
});
