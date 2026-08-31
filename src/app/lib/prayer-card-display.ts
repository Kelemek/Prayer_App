import { isCommunityPrayerCard } from './prayer-card-kind';
import type { PrayerCardIdentity } from './prayer-card-kind';
import { isCurrentUserPrayerRequester } from './prayer-card-user-context';

export type PrayerCardActiveFilter =
  | 'current'
  | 'answered'
  | 'archived'
  | 'total'
  | 'prompts'
  | 'personal'
  | 'memorize'
  | 'groups';

export function displayPrayerCardRequester(
  requester: string,
  isAnonymous: boolean | undefined
): string {
  return isAnonymous ? 'Anonymous' : requester;
}

export function showPrayerCardDescription(
  description: string | null | undefined
): boolean {
  return !!description?.trim();
}

export function showPrayerCardPrayedForBadge(
  prayedForCount: number | null | undefined,
  isPersonal: boolean,
  isAdmin: boolean,
  currentUserEmail: string,
  prayerEmail: string | null | undefined
): boolean {
  const count = prayedForCount ?? 0;
  if (count <= 0) return false;
  if (isPersonal) return true;
  if (isAdmin) return true;
  return isCurrentUserPrayerRequester(currentUserEmail, prayerEmail);
}

export function prayedForCountLabelForPrayerCard(
  prayedForCount: number | null | undefined,
  isPersonal: boolean
): string {
  if (isPersonal) {
    return (prayedForCount ?? 0) === 1 ? 'Prayer' : 'Prayers';
  }
  return 'Praying';
}

export function showsCommunityPrayerCardUnreadBadges(
  activeFilter: PrayerCardActiveFilter
): boolean {
  return activeFilter === 'current' || activeFilter === 'answered';
}

export function showPrayerCardReminderButton(
  sessionEmail: string,
  prayerId: string | null | undefined,
  isPersonal: boolean,
  prayerCategory: string | null | undefined,
  prayerStatus: string
): boolean {
  if (!sessionEmail || !prayerId) {
    return false;
  }
  if (isPersonal) {
    return prayerCategory !== 'Answered';
  }
  return prayerStatus === 'current';
}

export function showPrayerCardStatusPillInHeader(
  prayer: PrayerCardIdentity,
  isPersonal: boolean
): boolean {
  return isCommunityPrayerCard(prayer, isPersonal);
}

export function usesPrayerCardPersonalCooldown(isPersonal: boolean): boolean {
  return isPersonal;
}
