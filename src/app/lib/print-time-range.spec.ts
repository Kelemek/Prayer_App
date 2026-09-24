import { describe, expect, it } from 'vitest';
import {
  getPrintEmptyRangeUserMessage,
  getPrintRangeFileLabel,
  setPrintStartDateForTimeRange,
} from './print-time-range';
import type { TimeRange } from './print-types';

describe('print-time-range', () => {
  const end = new Date('2024-06-15T12:00:00Z');

  it('setPrintStartDateForTimeRange adjusts start for each range', () => {
    const ranges: TimeRange[] = ['week', 'twoweeks', 'month', 'twomonths', 'year', 'all'];
    for (const range of ranges) {
      const start = new Date(end);
      setPrintStartDateForTimeRange(start, end, range);
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
    }
    const allStart = new Date(end);
    setPrintStartDateForTimeRange(allStart, end, 'all');
    expect(allStart.getFullYear()).toBe(2000);
  });

  it('getPrintRangeFileLabel maps ranges', () => {
    expect(getPrintRangeFileLabel('week')).toBe('week');
    expect(getPrintRangeFileLabel('twoweeks')).toBe('2weeks');
    expect(getPrintRangeFileLabel('month')).toBe('month');
    expect(getPrintRangeFileLabel('twomonths')).toBe('2months');
    expect(getPrintRangeFileLabel('year')).toBe('year');
    expect(getPrintRangeFileLabel('all')).toBe('all');
  });

  it('getPrintEmptyRangeUserMessage returns user-facing copy', () => {
    expect(getPrintEmptyRangeUserMessage('week')).toContain('last week');
    expect(getPrintEmptyRangeUserMessage('twoweeks')).toContain('2 weeks');
    expect(getPrintEmptyRangeUserMessage('month')).toContain('last month');
    expect(getPrintEmptyRangeUserMessage('twomonths')).toContain('2 months');
    expect(getPrintEmptyRangeUserMessage('year')).toContain('last year');
    expect(getPrintEmptyRangeUserMessage('all')).toContain('database');
  });
});
