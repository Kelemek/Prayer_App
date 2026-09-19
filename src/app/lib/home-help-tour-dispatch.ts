import type { HelpSection } from '../types/help-content';
import {
  startAppSettingsTour,
  startCreatingPrayersTour,
  startEmailSubscriptionTour,
  startFeedbackTour,
  startFilteringTour,
  startMemorizeTour,
  startPersonalPrayersTour,
  startPrayerEncouragementTour,
  startPrayerPromptsTour,
  startPrayerRemindersTour,
  startPresentationModeTour,
  startPrintingTour,
  startSearchPrayersTour,
  type HomeHelpTourSectionStartContext,
} from './home-help-tour-section-starts';

export const HELP_SECTION_ID_PRESENTATION = 'help_presentation';

export const HOME_HELP_TOUR_SECTION_IDS = [
  'help_prayers',
  'help_filtering',
  'help_prompts',
  'help_prayer_encouragement',
  'help_search',
  'help_personal_prayers',
  'help_memorize',
  'help_printing',
  'help_email_subscription',
  'help_prayer_reminders',
  'help_feedback',
  'help_settings',
  HELP_SECTION_ID_PRESENTATION,
] as const;

export type HomeHelpTourSectionId = (typeof HOME_HELP_TOUR_SECTION_IDS)[number];

const HOME_HELP_TOUR_SECTION_ID_SET: ReadonlySet<string> = new Set(HOME_HELP_TOUR_SECTION_IDS);

export function isHomeHelpTourSectionId(id: string): id is HomeHelpTourSectionId {
  return HOME_HELP_TOUR_SECTION_ID_SET.has(id);
}

export function dispatchHomeHelpSectionTour(
  section: HelpSection,
  ctx: HomeHelpTourSectionStartContext
): boolean {
  const id = section.id;
  if (!isHomeHelpTourSectionId(id)) {
    return false;
  }
  switch (id) {
    case 'help_prayers':
      startCreatingPrayersTour(section, ctx);
      return true;
    case 'help_filtering':
      startFilteringTour(section, ctx);
      return true;
    case 'help_prompts':
      startPrayerPromptsTour(section, ctx);
      return true;
    case 'help_prayer_encouragement':
      void startPrayerEncouragementTour(section, ctx);
      return true;
    case 'help_search':
      startSearchPrayersTour(section, ctx);
      return true;
    case 'help_personal_prayers':
      startPersonalPrayersTour(section, ctx);
      return true;
    case 'help_memorize':
      startMemorizeTour(section, ctx);
      return true;
    case 'help_printing':
      startPrintingTour(section, ctx);
      return true;
    case 'help_email_subscription':
      startEmailSubscriptionTour(section, ctx);
      return true;
    case 'help_prayer_reminders':
      void startPrayerRemindersTour(section, ctx);
      return true;
    case 'help_feedback':
      startFeedbackTour(section, ctx);
      return true;
    case 'help_settings':
      startAppSettingsTour(section, ctx);
      return true;
    case HELP_SECTION_ID_PRESENTATION:
      startPresentationModeTour(section, ctx);
      return true;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
