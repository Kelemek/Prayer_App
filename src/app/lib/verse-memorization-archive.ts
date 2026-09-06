/** Days a verse-of-the-week prayer stays on Church Current before auto-archive. */
export const VERSE_MEMORIZATION_ARCHIVE_DAYS = 30;

/**
 * ISO cutoff for `approved_at`: verse memorization prayers approved strictly
 * before this timestamp are eligible for auto-archive.
 * Used by `send-prayer-reminders` (tenant-scoped) independent of `enable_auto_archive`.
 */
export function verseMemorizationArchiveCutoffIso(
  nowMs: number = Date.now(),
  days: number = VERSE_MEMORIZATION_ARCHIVE_DAYS
): string {
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}

/** True when a current approved verse prayer should leave Current. */
export function isVerseMemorizationPastArchiveWindow(options: {
  contentKind: string | null | undefined;
  status: string;
  approvalStatus: string;
  approvedAt: string | null | undefined;
  nowMs?: number;
  archiveDays?: number;
}): boolean {
  if (options.contentKind !== 'verse_memorization') {
    return false;
  }
  if (options.status !== 'current' || options.approvalStatus !== 'approved') {
    return false;
  }
  if (!options.approvedAt) {
    return false;
  }
  const cutoff = verseMemorizationArchiveCutoffIso(
    options.nowMs ?? Date.now(),
    options.archiveDays ?? VERSE_MEMORIZATION_ARCHIVE_DAYS
  );
  return options.approvedAt < cutoff;
}
