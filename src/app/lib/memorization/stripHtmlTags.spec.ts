import { describe, it, expect } from 'vitest';
import { stripHtmlTags } from './stripHtmlTags';

describe('stripHtmlTags', () => {
  it('returns empty string for nullish input', () => {
    expect(stripHtmlTags(null as unknown as string)).toBe('');
    expect(stripHtmlTags(undefined as unknown as string)).toBe('');
  });

  it('strips HTML tags in browser', () => {
    expect(stripHtmlTags('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });
});
