/** Mirror of spotlight helpers in send-user-hourly-memorization-reminders/index.ts for unit tests. Keep in sync. */

export interface MemorizationSpotlightCandidate {
  id: string;
  reference: string;
  kind: 'verse' | 'bibleBooks';
  completedSessions: number;
  lastPracticedAt: string | null;
}

export type MasteryTier = 0 | 1 | 2;

export function masteryTierFromCompletedCount(completedCount: number): MasteryTier {
  if (completedCount < 3) return 0;
  if (completedCount < 9) return 1;
  return 2;
}

export function masteryLevelLabel(tier: MasteryTier): string {
  switch (tier) {
    case 0:
      return 'Learning';
    case 1:
      return 'Practicing';
    case 2:
      return 'Mastered';
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

export function kindLabelForMemorizedItem(kind: 'verse' | 'bibleBooks'): string {
  return kind === 'bibleBooks' ? 'Bible books' : 'Verse';
}

function compareCandidates(
  a: MemorizationSpotlightCandidate,
  b: MemorizationSpotlightCandidate
): number {
  const tierA = masteryTierFromCompletedCount(a.completedSessions);
  const tierB = masteryTierFromCompletedCount(b.completedSessions);
  if (tierA !== tierB) return tierA - tierB;

  const lastA = a.lastPracticedAt ? Date.parse(a.lastPracticedAt) : null;
  const lastB = b.lastPracticedAt ? Date.parse(b.lastPracticedAt) : null;
  if (lastA === null && lastB !== null) return -1;
  if (lastA !== null && lastB === null) return 1;
  if (lastA !== null && lastB !== null && lastA !== lastB) return lastA - lastB;

  if (a.completedSessions !== b.completedSessions) {
    return a.completedSessions - b.completedSessions;
  }

  return a.reference.localeCompare(b.reference);
}

function samePriority(
  a: MemorizationSpotlightCandidate,
  b: MemorizationSpotlightCandidate
): boolean {
  const tierA = masteryTierFromCompletedCount(a.completedSessions);
  const tierB = masteryTierFromCompletedCount(b.completedSessions);
  if (tierA !== tierB) return false;

  const lastA = a.lastPracticedAt ? Date.parse(a.lastPracticedAt) : null;
  const lastB = b.lastPracticedAt ? Date.parse(b.lastPracticedAt) : null;
  return lastA === lastB && a.completedSessions === b.completedSessions;
}

export function pickMemorizationSpotlightCandidate(
  items: MemorizationSpotlightCandidate[],
  lastSpotlightId: string | null
): MemorizationSpotlightCandidate | null {
  if (items.length === 0) return null;

  const sorted = [...items].sort(compareCandidates);
  const best = sorted[0];
  const tied = sorted.filter((item) => samePriority(item, best));

  if (tied.length === 1) return tied[0];

  if (lastSpotlightId) {
    const alternate = tied.filter((item) => item.id !== lastSpotlightId);
    if (alternate.length > 0) return alternate[0];
  }

  return tied[0];
}
