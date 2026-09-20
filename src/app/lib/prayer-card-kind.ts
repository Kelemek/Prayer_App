import type { PrayerContentKind } from './prayer-types';

/** Minimal prayer identity for card-type helpers (home, presentation, print). */
export interface PrayerCardIdentity {
  id: string;
  user_email?: string | null;
  content_kind?: PrayerContentKind | null;
  is_shared_personal_prayer?: boolean;
}

export interface PrayerCardMutationContext {
  /** When `false`, never treat as personal (Church / community tab). When `true`, personal mutations. */
  isPersonalCard?: boolean;
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
  return !isPersonal && !isMemberPrayerId(prayer.id);
}

export type PrayerCardMutationKind = 'personal' | 'community' | 'member';

export function getPrayerCardMutationKind(
  prayer: PrayerCardIdentity,
  context: PrayerCardMutationContext = {}
): PrayerCardMutationKind {
  if (isMemberPrayerId(prayer.id)) {
    return 'member';
  }
  if (prayer.is_shared_personal_prayer) {
    return 'community';
  }
  if (context.isPersonalCard === true) {
    return 'personal';
  }
  if (context.isPersonalCard === false) {
    return 'community';
  }
  if (isPersonalPrayerCard(prayer)) {
    return 'personal';
  }
  return 'community';
}

export function memberPersonIdFromPrayerId(prayerId: string): string {
  return memberPrayerPersonId(prayerId) ?? '';
}

export function isMemberPrayerId(prayerId: string | null | undefined): boolean {
  return !!prayerId?.startsWith('pc-member-');
}

export function memberPrayerPersonId(prayerId: string): string | null {
  if (!isMemberPrayerId(prayerId)) {
    return null;
  }
  return prayerId.slice('pc-member-'.length);
}
