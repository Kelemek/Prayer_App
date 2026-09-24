import { describe, expect, it, vi } from 'vitest';
import { shuffleCopy } from './shuffle-copy';

describe('shuffleCopy', () => {
  it('returns a permutation with the same elements', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const input = [1, 2, 3, 4];
    const out = shuffleCopy(input);
    expect(out.sort()).toEqual(input.sort());
    expect(out).not.toBe(input);
    vi.restoreAllMocks();
  });

  it('handles empty arrays', () => {
    expect(shuffleCopy([])).toEqual([]);
  });
});
