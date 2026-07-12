import { describe, expect, it } from 'vitest';
import type { MemorizedItem } from '../../types/memorization';
import {
  isKeyboardPracticeMode,
  memorizationNeedsKeyboardOnOpen,
} from './memorizationKeyboardPractice';

const base: MemorizedItem = {
  id: 'v1',
  reference: 'John 3:16',
  text: '',
  translation: 'esv',
  dateAdded: 1,
  lastPracticedAt: null,
  practiceSessions: [],
};

describe('memorizationKeyboardPractice', () => {
  it('isKeyboardPracticeMode only for type and firstLetters', () => {
    expect(isKeyboardPracticeMode('type')).toBe(true);
    expect(isKeyboardPracticeMode('firstLetters')).toBe(true);
    expect(isKeyboardPracticeMode('word')).toBe(false);
    expect(isKeyboardPracticeMode('reorder')).toBe(false);
    expect(isKeyboardPracticeMode(null)).toBe(false);
  });

  it('needs keyboard on open for in-round type/firstLetters resume', () => {
    expect(
      memorizationNeedsKeyboardOnOpen({
        ...base,
        inProgressPractice: {
          sessionSeed: 's',
          wrongAttempts: 0,
          correctKeystrokes: 0,
          updatedAt: 1,
          phase: { kind: 'inRound', roundIndex: 1 },
          practiceMode: 'type',
        },
      })
    ).toBe(true);

    expect(
      memorizationNeedsKeyboardOnOpen({
        ...base,
        inProgressPractice: {
          sessionSeed: 's',
          wrongAttempts: 0,
          correctKeystrokes: 0,
          updatedAt: 1,
          phase: { kind: 'inRound', roundIndex: 1 },
          practiceMode: 'firstLetters',
        },
      })
    ).toBe(true);
  });

  it('does not need keyboard for fresh items, between-rounds, or non-keyboard modes', () => {
    expect(memorizationNeedsKeyboardOnOpen(base)).toBe(false);
    expect(
      memorizationNeedsKeyboardOnOpen({
        ...base,
        inProgressPractice: {
          sessionSeed: 's',
          wrongAttempts: 0,
          correctKeystrokes: 0,
          updatedAt: 1,
          phase: { kind: 'betweenRounds', completedRoundIndex: 1 },
          practiceMode: 'type',
        },
      })
    ).toBe(false);
    expect(
      memorizationNeedsKeyboardOnOpen({
        ...base,
        inProgressPractice: {
          sessionSeed: 's',
          wrongAttempts: 0,
          correctKeystrokes: 0,
          updatedAt: 1,
          phase: { kind: 'inRound', roundIndex: 1 },
          practiceMode: 'word',
        },
      })
    ).toBe(false);
  });
});
