import type { UserSessionData } from '../services/user-session.service';
import type { UserSessionService } from '../services/user-session.service';

export function getPrayerCardUserEmail(
  userSessionService: UserSessionService
): string {
  const session = userSessionService.getCurrentSession?.() ?? null;
  return session?.email || '';
}

export function hasPrayerHourReminders(
  session: UserSessionData | null | undefined
): boolean {
  return (session?.prayerHourReminders?.length ?? 0) > 0;
}

export function getPrayerCardUserNameFromStorage(): string {
  const firstName = localStorage.getItem('prayerapp_user_first_name') || '';
  const lastName = localStorage.getItem('prayerapp_user_last_name') || '';
  return `${firstName} ${lastName}`.trim();
}

export function isCurrentUserPrayerRequester(
  currentUserEmail: string,
  prayerEmail: string | null | undefined
): boolean {
  return currentUserEmail.toLowerCase() === (prayerEmail || '').toLowerCase();
}
