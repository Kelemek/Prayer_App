import { describe, it, expect } from 'vitest';
import {
  buildMemorizationTokens,
  cueGlyphForTypableToken,
  firstLetterOfWord,
  generateMemorizationSessionSeed,
  getWordsForMemorization,
  hiddenFractionForRound,
  pickHiddenWordIndices,
  MEMORIZATION_FULL_HIDE_ROUND,
} from './memorizationPracticeUtils';
import { getMasterLevel, countCompletedSessions } from './memorization-mastery';
import type { MemorizedItem } from '../../types/memorization';

describe('memorizationPracticeUtils', () => {
  it('getWordsForMemorization splits on whitespace', () => {
    expect(getWordsForMemorization('For God so loved')).toEqual([
      'For',
      'God',
      'so',
      'loved',
    ]);
  });

  it('hiddenFractionForRound scales to 100% at round 5', () => {
    expect(hiddenFractionForRound(0)).toBe(0);
    expect(hiddenFractionForRound(1)).toBe(0.2);
    expect(hiddenFractionForRound(MEMORIZATION_FULL_HIDE_ROUND)).toBe(1);
  });

  it('pickHiddenWordIndices is deterministic for same seed', () => {
    const a = pickHiddenWordIndices(10, 2, 'verse-id-1');
    const b = pickHiddenWordIndices(10, 2, 'verse-id-1');
    expect([...a].sort((x, y) => x - y)).toEqual([...b].sort((x, y) => x - y));
  });

  it('generateMemorizationSessionSeed returns a non-empty string', () => {
    const s = generateMemorizationSessionSeed();
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });

  it('firstLetterOfWord skips punctuation', () => {
    expect(firstLetterOfWord('God,')).toBe('g');
    expect(firstLetterOfWord('(Son)')).toBe('s');
  });

  it('cueGlyphForTypableToken returns first letter or digit', () => {
    expect(cueGlyphForTypableToken({ kind: 'word', text: 'God,' })).toBe('G');
    expect(cueGlyphForTypableToken({ kind: 'digit', text: '3' })).toBe('3');
  });

  it('buildMemorizationTokens includes reference tokens', () => {
    const tokens = buildMemorizationTokens('In the beginning', 'Genesis 1:1');
    expect(tokens.length).toBeGreaterThan(0);
    expect(formatMemorizationTokensPlain(tokens)).toContain('beginning');
  });
});

function formatMemorizationTokensPlain(
  tokens: ReturnType<typeof buildMemorizationTokens>
): string {
  return tokens.map((t) => t.text).join(' ');
}

describe('memorization-mastery', () => {
  const base: MemorizedItem = {
    id: '1',
    reference: 'John 3:16',
    text: 'For God so loved the world',
    translation: 'esv',
    dateAdded: Date.now(),
    lastPracticedAt: null,
    practiceSessions: [],
  };

  it('getMasterLevel returns learning below 3 completed sessions', () => {
    expect(getMasterLevel(base)).toBe('learning');
    expect(
      getMasterLevel({
        ...base,
        practiceSessions: [
          { date: 1, wrongAttempts: 0, correctKeystrokes: 1, completed: true },
          { date: 2, wrongAttempts: 0, correctKeystrokes: 1, completed: true },
        ],
      })
    ).toBe('learning');
  });

  it('getMasterLevel returns practicing at 3-8 sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      date: i,
      wrongAttempts: 0,
      correctKeystrokes: 1,
      completed: true,
    }));
    expect(getMasterLevel({ ...base, practiceSessions: sessions })).toBe('practicing');
  });

  it('countCompletedSessions ignores incomplete sessions', () => {
    expect(
      countCompletedSessions({
        ...base,
        practiceSessions: [
          { date: 1, wrongAttempts: 0, correctKeystrokes: 0, completed: false },
          { date: 2, wrongAttempts: 0, correctKeystrokes: 1, completed: true },
        ],
      })
    ).toBe(1);
  });
});
