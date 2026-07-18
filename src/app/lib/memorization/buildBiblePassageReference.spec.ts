import { describe, it, expect } from 'vitest';
import { buildBiblePassageReference } from './buildBiblePassageReference';

describe('buildBiblePassageReference', () => {
  it('builds chapter-only reference', () => {
    expect(buildBiblePassageReference('GEN', 'Genesis', 1, null, null)).toBe('Genesis 1');
  });

  it('builds single-verse reference', () => {
    expect(buildBiblePassageReference('GEN', 'Genesis', 1, 1, null)).toBe('Genesis 1:1');
  });

  it('builds verse range reference with ordered endpoints', () => {
    expect(buildBiblePassageReference('GEN', 'Genesis', 1, 5, 2)).toBe('Genesis 1:2-5');
  });
});
