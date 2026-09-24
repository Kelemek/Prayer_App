import { describe, expect, it } from 'vitest';
import {
  encodePrintUtf8Base64,
  estimateBookletUnitWeight,
  getBookletDescriptionSegmentMaxChars,
  getBookletSortedFirstUpdateMarkdown,
  hardSplitBookletMarkdown,
  packBookletUnitsIntoPageChunks,
  partitionBookletUnitsIntoChunks,
  splitBookletMarkdownIntoPanelParts,
} from './print-booklet-pack';
import type { Prayer } from './print-types';

describe('print-booklet-pack', () => {
  it('encodePrintUtf8Base64 round-trips ascii', () => {
    expect(encodePrintUtf8Base64('hello')).toBe(btoa('hello'));
  });

  it('getBookletSortedFirstUpdateMarkdown picks newest content', () => {
    const prayer = {
      prayer_updates: [
        { content: 'old', created_at: '2020-01-01T00:00:00Z' },
        { content: 'newest', created_at: '2024-01-01T00:00:00Z' },
      ],
    } as Prayer;
    expect(getBookletSortedFirstUpdateMarkdown(prayer)).toBe('newest');
  });

  it('getBookletDescriptionSegmentMaxChars shrinks when updates are heavy', () => {
    const longUpdate = 'x'.repeat(800);
    const withUpdate = getBookletDescriptionSegmentMaxChars(longUpdate);
    const without = getBookletDescriptionSegmentMaxChars(null);
    expect(withUpdate).toBeLessThan(without);
    expect(withUpdate).toBeGreaterThanOrEqual(260);
  });

  it('partitionBookletUnitsIntoChunks respects weight budget', () => {
    const units = [
      { html: 'a', weight: 100 },
      { html: 'b', weight: 100 },
      { html: 'c', weight: 100 },
    ];
    const chunks = partitionBookletUnitsIntoChunks(units, 250, 20, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('packBookletUnitsIntoPageChunks includes section heading once', () => {
    const html = packBookletUnitsIntoPageChunks(
      [{ html: '<p>x</p>', weight: 50 }],
      '<h2>Section</h2>',
      500,
      30,
      10
    );
    expect(html[0]).toContain('Section');
    expect(html[0]).toContain('booklet-chunk');
  });

  it('splitBookletMarkdownIntoPanelParts splits long paragraphs', () => {
    const md = 'para one\n\n' + 'word '.repeat(200);
    const parts = splitBookletMarkdownIntoPanelParts(md, 120);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(p => p.length <= 120 || p.includes('\n'))).toBe(true);
  });

  it('hardSplitBookletMarkdown produces bounded chunks', () => {
    const text = 'a'.repeat(500);
    const pieces = hardSplitBookletMarkdown(text, 100);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join('').replace(/\s/g, '').length).toBeGreaterThanOrEqual(500);
  });

  it('estimateBookletUnitWeight increases with markdown and updates', () => {
    const base = estimateBookletUnitWeight('short', null);
    const heavy = estimateBookletUnitWeight('short', 'update text');
    expect(heavy).toBeGreaterThan(base);
  });
});
