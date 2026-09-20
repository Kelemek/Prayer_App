import type { PrayerUpdate } from '../services/prayer.service';
import type { PrayerCardAddUpdateEvent } from './prayer-card-events';
import type { PrayerAddUpdatePayload } from '../components/prayer-add-update-modal/prayer-add-update-modal.component';
import type { PrayerUpdateActionsMode } from '../components/prayer-update-actions/prayer-update-actions.component';
import type { PersonalPrayerAnsweredStatusMode } from '../components/personal-prayer-answered-status-modal/personal-prayer-answered-status-modal.component';
import type { PrayerUpdateRecord } from './prayer-update-header';
import {
  getPrayerCardUserEmail,
  getPrayerCardUserNameFromStorage,
} from './prayer-card-user-context';
import { resolveAuthorName } from '../utils/display-name';
import type { UserSessionService } from '../services/user-session.service';
import { resolvePrayerUpdateContent } from './prayer-update-content';

export function buildPrayerCardAddUpdateEvent(
  prayerId: string,
  payload: PrayerAddUpdatePayload,
  userSessionService: UserSessionService,
  isPersonalCard = false
): PrayerCardAddUpdateEvent {
  const userEmail = getPrayerCardUserEmail(userSessionService);
  const userSession = userSessionService.getCurrentSession?.() ?? null;
  const authorName = resolveAuthorName(
    userSession?.fullName || getPrayerCardUserNameFromStorage(),
    userEmail
  );

  return {
    prayer_id: prayerId,
    content: resolvePrayerUpdateContent(
      payload.content,
      payload.mark_as_answered
    ),
    author: authorName,
    author_email: userEmail,
    is_anonymous: payload.is_anonymous,
    mark_as_answered: payload.mark_as_answered,
    is_personal_card: isPersonalCard,
  };
}

export function prayerUpdateFromRecord(
  update: PrayerUpdateRecord,
  prayerId: string
): PrayerUpdate {
  return {
    id: update.id,
    prayer_id: prayerId,
    content: update.content,
    author: update.author ?? '',
    created_at: update.created_at,
    updated_at: update.updated_at,
    is_answered: update.is_answered,
    is_anonymous: update.is_anonymous,
  };
}

export function prayerCardUpdateActionsMode(
  isPersonal: boolean
): PrayerUpdateActionsMode {
  return isPersonal ? 'personal' : 'readonly';
}

export function personalAnsweredStatusModalMode(
  category: string | null | undefined
): PersonalPrayerAnsweredStatusMode {
  return category === 'Answered' ? 'unmark' : 'mark';
}
