import { adminIntroTourSectionIdsFromCatalog } from './admin-help-catalog';
import { ADMIN_INTRO_TOUR_SECTION_IDS, type AdminIntroTourSectionId } from './admin-help-tour-ids';
import {
  isAdminHelpSectionVisibleInTour,
  type AdminHelpTourVisibilityContext,
} from './admin-help-tour-visibility';
import type { HelpSection } from '../types/help-content';
import type { AdminSettingsTab } from './admin-settings-tabs';

export function filterAdminIntroTourSections(
  sections: readonly HelpSection[],
  ctx: AdminHelpTourVisibilityContext
): HelpSection[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered: HelpSection[] = [];
  for (const id of adminIntroTourSectionIdsFromCatalog()) {
    if (!isAdminHelpSectionVisibleInTour(id, ctx)) {
      continue;
    }
    const section = byId.get(id);
    if (section?.isActive) {
      ordered.push(section);
    }
  }
  return ordered;
}

export function firstVisibleAdminSettingsTabForIntro(
  ctx: Pick<AdminHelpTourVisibilityContext, 'showAnalyticsTab'>
): AdminSettingsTab {
  return ctx.showAnalyticsTab ? 'analytics' : 'content';
}

export function isAdminIntroTourSectionId(id: string): id is AdminIntroTourSectionId {
  return (ADMIN_INTRO_TOUR_SECTION_IDS as readonly string[]).includes(id);
}
