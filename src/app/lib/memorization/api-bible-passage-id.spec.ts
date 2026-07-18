import { describe, it, expect } from 'vitest';
import {
  bookNameToUsfm,
  canonicalScriptureCacheReference,
  referenceToApiBiblePassageId,
  usfmBookPrefixesForSearchQuery,
} from './api-bible-passage-id';

describe('api-bible-passage-id', () => {
  it('maps common book aliases to USFM', () => {
    expect(bookNameToUsfm('John')).toBe('JHN');
    expect(bookNameToUsfm('Psalms')).toBe('PSA');
    expect(bookNameToUsfm('First Samuel')).toBe('1SA');
    expect(bookNameToUsfm('Not A Book')).toBeNull();
  });

  it('builds passage ids from references', () => {
    expect(referenceToApiBiblePassageId('John 3:16')).toBe('JHN.3.16');
    expect(referenceToApiBiblePassageId('John 3:16-18')).toBe('JHN.3.16-JHN.3.18');
    expect(referenceToApiBiblePassageId('Psalm 23')).toBe('PSA.23');
  });

  it('canonicalScriptureCacheReference normalizes suffixes', () => {
    expect(canonicalScriptureCacheReference('John 3:16a')).toBe('JHN.3.16');
    expect(canonicalScriptureCacheReference('Unknown Book 1')).toBe('Unknown Book 1');
  });

  it('usfmBookPrefixesForSearchQuery finds prefix matches', () => {
    expect(usfmBookPrefixesForSearchQuery('joh')).toContain('JHN');
    expect(usfmBookPrefixesForSearchQuery('rom')).toContain('ROM');
    expect(usfmBookPrefixesForSearchQuery('')).toEqual([]);
  });
});
