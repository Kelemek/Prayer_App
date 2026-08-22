import type { PrayerRequest } from '../services/prayer.service';
import {
  displayPrayerCardRequester,
  prayedForCountLabelForPrayerCard,
  showPrayerCardDescription,
  showPrayerCardPrayedForBadge,
  showPrayerCardReminderButton,
  showPrayerCardStatusPillInHeader,
  showsCommunityPrayerCardUnreadBadges,
  usesPrayerCardPersonalCooldown,
  type PrayerCardActiveFilter,
} from './prayer-card-display';
import { isCommunityPrayerCard } from './prayer-card-kind';
import type { PrayerCardVariant } from './prayer-card-layout';
import {
  getPrayerCardBorderClass,
  getPrayerCardShellClasses,
} from './prayer-card-shell';
import {
  showPrayerCardAddUpdateButton,
  showPrayerCardDeleteButton,
  showPrayerCardUpdateDeleteButton,
  type PrayerCardPermissionContext,
} from './prayer-card-permissions';

export interface PrayerCardViewStateInput {
  variant: PrayerCardVariant;
  prayer: PrayerRequest;
  isAdmin: boolean;
  isPersonal: boolean;
  activeFilter: PrayerCardActiveFilter;
  deletionsAllowed: PrayerCardPermissionContext['deletionsAllowed'];
  updatesAllowed: PrayerCardPermissionContext['updatesAllowed'];
  reminderSessionEmail: string;
  currentUserEmail: string;
}

export interface PrayerCardViewState {
  displayRequester: string;
  showDescription: boolean;
  showsCommunityUnreadBadges: boolean;
  showStatusPillInHeader: boolean;
  showDeleteButton: boolean;
  showReminderButton: boolean;
  showAddUpdateButton: boolean;
  showUpdateDeleteButton: boolean;
  showPrayedForBadge: boolean;
  prayedForCountLabel: string;
  usesPersonalCooldown: boolean;
  isCommunityPrayer: boolean;
  shellClasses: string;
  borderClass: string;
}

export function computePrayerCardViewState(
  input: PrayerCardViewStateInput
): PrayerCardViewState {
  const { prayer, isPersonal, isAdmin, variant } = input;
  const permissionContext: PrayerCardPermissionContext = {
    prayerId: prayer.id,
    prayerEmail: prayer.email,
    isAdmin,
    isPersonal,
    deletionsAllowed: input.deletionsAllowed,
    updatesAllowed: input.updatesAllowed,
    currentUserEmail: input.currentUserEmail,
  };
  const borderClass = getPrayerCardBorderClass(prayer.status, isPersonal);

  return {
    displayRequester: displayPrayerCardRequester(
      prayer.requester,
      prayer.is_anonymous
    ),
    showDescription: showPrayerCardDescription(prayer.description),
    showsCommunityUnreadBadges: showsCommunityPrayerCardUnreadBadges(
      input.activeFilter
    ),
    showStatusPillInHeader: showPrayerCardStatusPillInHeader(prayer, isPersonal),
    showDeleteButton: showPrayerCardDeleteButton(permissionContext),
    showReminderButton: showPrayerCardReminderButton(
      input.reminderSessionEmail,
      prayer.id,
      isPersonal,
      prayer.category,
      prayer.status
    ),
    showAddUpdateButton: showPrayerCardAddUpdateButton(permissionContext),
    showUpdateDeleteButton: showPrayerCardUpdateDeleteButton(permissionContext),
    showPrayedForBadge: showPrayerCardPrayedForBadge(
      prayer.prayed_for_count,
      isPersonal,
      isAdmin,
      input.currentUserEmail,
      prayer.email
    ),
    prayedForCountLabel: prayedForCountLabelForPrayerCard(
      prayer.prayed_for_count,
      isPersonal
    ),
    usesPersonalCooldown: usesPrayerCardPersonalCooldown(isPersonal),
    isCommunityPrayer: isCommunityPrayerCard(prayer, isPersonal),
    shellClasses: getPrayerCardShellClasses(variant, borderClass),
    borderClass,
  };
}
