import { describe, expect, it } from 'vitest';
import {
  pickMemorizationSpotlightCandidate,
  masteryTierFromCompletedCount,
} from './memorization-reminder-spotlight';

function item(
  id: string,
  completedSessions: number,
  lastPracticedAt: string | null = null,
  reference = id
) {
  return {
    id,
    reference,
    kind: 'verse' as const,
    completedSessions,
    lastPracticedAt,
  };
}

describe('memorization-reminder-spotlight', () => {
  it('masteryTierFromCompletedCount matches app thresholds', () => {
    expect(masteryTierFromCompletedCount(0)).toBe(0);
    expect(masteryTierFromCompletedCount(2)).toBe(0);
    expect(masteryTierFromCompletedCount(3)).toBe(1);
    expect(masteryTierFromCompletedCount(8)).toBe(1);
    expect(masteryTierFromCompletedCount(9)).toBe(2);
  });

  it('prefers learning over practicing and mastered', () => {
    const pick = pickMemorizationSpotlightCandidate(
      [
        item('mastered', 10, '2026-01-01T00:00:00Z'),
        item('learning', 1, '2026-01-01T00:00:00Z'),
        item('practicing', 5, '2026-01-01T00:00:00Z'),
      ],
      null
    );
    expect(pick?.id).toBe('learning');
  });

  it('prefers never practiced over older practice date', () => {
    const pick = pickMemorizationSpotlightCandidate(
      [item('old', 1, '2025-01-01T00:00:00Z'), item('never', 1, null)],
      null
    );
    expect(pick?.id).toBe('never');
  });

  it('tie-break rotates away from last spotlight id', () => {
    const pick = pickMemorizationSpotlightCandidate(
      [item('a', 0, null, 'John 3:16'), item('b', 0, null, 'Romans 8:28')],
      'a'
    );
    expect(pick?.id).toBe('b');
  });

  it('returns null for empty list', () => {
    expect(pickMemorizationSpotlightCandidate([], null)).toBeNull();
  });
});
