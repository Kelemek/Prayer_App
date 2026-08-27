import type { PrayerContentKind } from './prayer-types';

/** Minimal prayer identity for card-type helpers (home, presentation, print). */
export interface PrayerCardIdentity {
  id: string;
  user_email?: string | null;
  content_kind?: PrayerContentKind | null;
}

export function isVerseMemorizationPrayer(
  prayer: PrayerCardIdentity | null | undefined
): boolean {
  return prayer?.content_kind === 'verse_memorization';
}

export function isPersonalPrayerCard(
  prayer: PrayerCardIdentity,
  isPersonalFlag = false
): boolean {
  return isPersonalFlag || !!prayer.user_email;
}

export function isCommunityPrayerCard(
  prayer: PrayerCardIdentity,
  isPersonal = false
): boolean {
  return !isPersonal;
}

export type PrayerCardMutationKind = 'personal' | 'community';

export function getPrayerCardMutationKind(
  prayer: PrayerCardIdentity,
  isPersonalFlag = false
): PrayerCardMutationKind {
  if (isPersonalPrayerCard(prayer, isPersonalFlag)) {
    return 'personal';
  }
  return 'community';
}
