import { describe, expect, it } from 'vitest';
import { isNearQuota } from './plan-quota';

describe('isNearQuota', () => {
  it('warns at 4/5 members', () => {
    expect(isNearQuota(4, 5)).toBe(true);
  });

  it('does not warn at 5/5 (at cap)', () => {
    expect(isNearQuota(5, 5)).toBe(false);
  });

  it('does not warn at 0/1 or 1/1 for single group cap', () => {
    expect(isNearQuota(0, 1)).toBe(false);
    expect(isNearQuota(1, 1)).toBe(false);
  });

  it('warns at 8/10 groups', () => {
    expect(isNearQuota(8, 10)).toBe(true);
  });

  it('returns false when max is zero', () => {
    expect(isNearQuota(0, 0)).toBe(false);
  });
});
