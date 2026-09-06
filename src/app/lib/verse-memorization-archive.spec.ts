import { describe, it, expect } from 'vitest';
import {
  VERSE_MEMORIZATION_ARCHIVE_DAYS,
  isVerseMemorizationPastArchiveWindow,
  verseMemorizationArchiveCutoffIso,
} from './verse-memorization-archive';

describe('verse-memorization-archive', () => {
  const nowMs = Date.parse('2026-09-06T12:00:00.000Z');

  it('uses a 30-day archive window', () => {
    expect(VERSE_MEMORIZATION_ARCHIVE_DAYS).toBe(30);
  });

  it('verseMemorizationArchiveCutoffIso is 30 days before now', () => {
    expect(verseMemorizationArchiveCutoffIso(nowMs)).toBe(
      '2026-08-07T12:00:00.000Z'
    );
  });

  it('archives current approved verse prayers older than the cutoff', () => {
    expect(
      isVerseMemorizationPastArchiveWindow({
        contentKind: 'verse_memorization',
        status: 'current',
        approvalStatus: 'approved',
        approvedAt: '2026-08-01T00:00:00.000Z',
        nowMs,
      })
    ).toBe(true);
  });

  it('keeps verse prayers inside the 30-day window', () => {
    expect(
      isVerseMemorizationPastArchiveWindow({
        contentKind: 'verse_memorization',
        status: 'current',
        approvalStatus: 'approved',
        approvedAt: '2026-08-20T00:00:00.000Z',
        nowMs,
      })
    ).toBe(false);
  });

  it('ignores non-verse and non-current prayers', () => {
    expect(
      isVerseMemorizationPastArchiveWindow({
        contentKind: null,
        status: 'current',
        approvalStatus: 'approved',
        approvedAt: '2026-01-01T00:00:00.000Z',
        nowMs,
      })
    ).toBe(false);
    expect(
      isVerseMemorizationPastArchiveWindow({
        contentKind: 'verse_memorization',
        status: 'archived',
        approvalStatus: 'approved',
        approvedAt: '2026-01-01T00:00:00.000Z',
        nowMs,
      })
    ).toBe(false);
  });
});
