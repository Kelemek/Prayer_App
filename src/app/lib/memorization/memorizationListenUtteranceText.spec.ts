import { describe, it, expect } from 'vitest';
import {
  referenceToSpeechText,
  getMemorizationListenUtteranceText,
} from './memorizationListenUtteranceText';
import type { MemorizedItem } from '../../types/memorization';

const baseItem: MemorizedItem = {
  id: '1',
  reference: 'John 3:16',
  text: 'For God so loved the world',
  translation: 'esv',
  dateAdded: Date.now(),
  lastPracticedAt: null,
  practiceSessions: [],
};

describe('referenceToSpeechText', () => {
  it('speaks full verse reference', () => {
    expect(referenceToSpeechText('John 3:16')).toBe('John chapter 3, verse 16');
    expect(referenceToSpeechText('1 John 3:16')).toBe('first John chapter 3, verse 16');
  });

  it('speaks verse range', () => {
    expect(referenceToSpeechText('John 3:16-18')).toBe(
      'John chapter 3, verses 16 through 18'
    );
  });

  it('speaks chapter-only numeric reference', () => {
    expect(referenceToSpeechText('3:16')).toBe('chapter 3, verse 16');
    expect(referenceToSpeechText('3:16-18')).toBe('chapter 3, verses 16 through 18');
  });

  it('normalizes dashes', () => {
    expect(referenceToSpeechText('John 3:16–18')).toContain('verses 16 through 18');
  });

  it('returns empty for empty reference', () => {
    expect(referenceToSpeechText('')).toBe('');
  });

  it('falls back to generic chapter/verse replacement', () => {
    expect(referenceToSpeechText('Some ref 3:16')).toBe('Some ref chapter 3, verse 16');
  });
});

describe('getMemorizationListenUtteranceText', () => {
  it('combines body and spoken reference for verse items', () => {
    const text = getMemorizationListenUtteranceText(baseItem);
    expect(text).toContain('For God so loved the world');
    expect(text).toContain('John chapter 3, verse 16');
  });

  it('uses passageText when item text is empty (verse fetch-on-demand)', () => {
    const text = getMemorizationListenUtteranceText(
      { ...baseItem, text: '' },
      'For God so loved the world'
    );
    expect(text).toContain('For God so loved the world');
    expect(text).toContain('John chapter 3, verse 16');
  });

  it('returns reference only when body is empty', () => {
    expect(
      getMemorizationListenUtteranceText({ ...baseItem, text: '   ' })
    ).toBe('John chapter 3, verse 16');
  });

  it('returns body only when reference is empty', () => {
    expect(
      getMemorizationListenUtteranceText({ ...baseItem, reference: '' })
    ).toBe('For God so loved the world');
  });

  it('speaks bible books list for bibleBooks items', () => {
    const item: MemorizedItem = {
      ...baseItem,
      kind: 'bibleBooks',
      bibleBooksScope: 'nt',
      reference: 'Bible Books (NT)',
      text: 'Matthew Mark',
    };
    const text = getMemorizationListenUtteranceText(item);
    expect(text).toContain('Matthew');
    expect(text).toContain('Revelation');
    expect(text).not.toContain('chapter');
  });
});
