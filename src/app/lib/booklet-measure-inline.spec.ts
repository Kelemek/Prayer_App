import { describe, expect, it } from 'vitest';
import { buildBookletMeasurePackScript } from './booklet-measure-inline';

describe('buildBookletMeasurePackScript', () => {
  it('returns an IIFE script for booklet measurement', () => {
    const script = buildBookletMeasurePackScript();
    expect(script).toContain('padToFourWithBackLast');
    expect(script).toContain('booklet-dynamic-root');
    expect(script).toContain('window.print');
  });
});
