import { describe, expect, it } from 'vitest';
import { formatReciteCostUsd } from './format-recite-cost';

describe('formatReciteCostUsd', () => {
  it('formats USD with two decimals', () => {
    expect(formatReciteCostUsd(1.2)).toBe('$1.20');
    expect(formatReciteCostUsd(0)).toBe('$0.00');
  });
});
