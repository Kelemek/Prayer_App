import { describe, it, expect } from 'vitest';
import {
  formatApiBibleJsonPassageContent,
  formatApiBiblePassageContent,
  formatApiBiblePassageText,
  normalizeScriptureCachedText,
} from './api-bible-format';

describe('api-bible-format', () => {
  it('formats JSON passage trees with verse numbers', () => {
    const text = formatApiBibleJsonPassageContent([
      {
        name: 'para',
        items: [
          { name: 'verse', attrs: { number: '1' } },
          { type: 'text', text: 'In the beginning' },
        ],
      },
    ]);
    expect(text).toContain('[1] In the beginning');
  });

  it('formats plain text with leading verse numbers', () => {
    expect(formatApiBiblePassageText('1 In the beginning\n2 And the earth')).toContain('[1]');
    expect(formatApiBiblePassageText('1 In the beginning\n2 And the earth')).toContain('[2]');
  });

  it('formats verses-array JSON payloads', () => {
    const raw = JSON.stringify({
      verses: [{ verse: 1, text: 'Hello' }, { verse: 2, text: 'World' }],
    });
    expect(formatApiBiblePassageContent(raw)).toContain('[1] Hello');
    expect(formatApiBiblePassageContent(raw)).toContain('[2] World');
  });

  it('strips hash-wrapped dashes when normalizing cached text', () => {
    expect(normalizeScriptureCachedText('word #—# next')).toContain('word — next');
  });

  it('parses embedded JSON content trees from plain strings', () => {
    const raw = JSON.stringify([
      {
        name: 'para',
        items: [
          { name: 'verse', attrs: { number: '2' } },
          { type: 'text', text: 'And the earth' },
        ],
      },
    ]);
    expect(formatApiBiblePassageContent(raw)).toContain('[2] And the earth');
  });

  it('formats numbered plain-text lines without brackets', () => {
    expect(formatApiBiblePassageText('1 In the beginning\n2 And the earth')).toContain(
      '[2] And the earth'
    );
  });

  it('skips note nodes and joins multiple paragraphs', () => {
    const text = formatApiBibleJsonPassageContent([
      {
        name: 'para',
        items: [
          { name: 'verse', attrs: { number: '1' } },
          { type: 'text', text: 'Hello' },
          { name: 'note' },
        ],
      },
      {
        name: 'para',
        items: [
          { name: 'verse', attrs: { number: '2' } },
          { type: 'text', text: 'World' },
        ],
      },
    ]);
    expect(text).toContain('[1] Hello');
    expect(text).toContain('[2] World');
    expect(text).toContain('\n\n');
  });

  it('preserves text that already has bracket verse numbers', () => {
    expect(formatApiBiblePassageText('[1] Already formatted')).toContain('[1] Already formatted');
  });

  it('formats array roots without stringifying first', () => {
    const text = formatApiBiblePassageContent([
      {
        name: 'para',
        items: [
          { name: 'verse', attrs: { number: '3' } },
          { type: 'text', text: 'Direct array' },
        ],
      },
    ]);
    expect(text).toContain('[3] Direct array');
  });
});
