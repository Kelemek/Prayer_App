import type { HelpSection } from '../types/help-content';
import { isAdminHelpTourSectionId } from './admin-help-tour-ids';
import {
  startAdminPreparedSectionTour,
  type AdminHelpTourSectionStartContext,
} from './admin-help-tour-run';

export {
  ADMIN_HELP_TOUR_SECTION_IDS,
  ADMIN_INTRO_TOUR_SECTION_IDS,
  ADMIN_QUEUE_HELP_TOUR_SECTION_IDS,
  isAdminHelpTourSectionId,
  type AdminHelpTourSectionId,
  type AdminIntroTourSectionId,
  type AdminQueueHelpTourSectionId,
} from './admin-help-tour-ids';

export type { AdminHelpTourSectionStartContext };

export function dispatchAdminHelpSectionTour(
  section: HelpSection,
  ctx: AdminHelpTourSectionStartContext
): boolean {
  const id = section.id;
  if (!isAdminHelpTourSectionId(id)) {
    return false;
  }
  startAdminPreparedSectionTour(section, ctx);
  return true;
}
