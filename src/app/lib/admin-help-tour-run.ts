import type { HelpSection } from '../types/help-content';
import type { AdminHelpDriverTourService } from '../services/admin-help-driver-tour.service';
import type { AdminHelpTourHost } from '../services/admin-help-tour-host.adapter';
import type { AdminHelpTourSettingsTabState } from '../services/admin-help-tour-settings-tab-state.service';
import { ADMIN_HELP_TOUR_PREPARE } from './admin-help-tour-prepare';
import type { AdminHelpTourSectionId } from './admin-help-tour-ids';
import { ADMIN_HELP_TOUR_TIMING } from './admin-help-tour-timing';

export interface AdminHelpTourSectionStartContext {
  host: AdminHelpTourHost;
  adminHelpDriverTourService: AdminHelpDriverTourService;
  settingsTabState: AdminHelpTourSettingsTabState;
}

export async function runAdminPreparedHighlightTour(
  section: HelpSection,
  ctx: AdminHelpTourSectionStartContext
): Promise<void> {
  const id = section.id;
  if (!isPreparedAdminTourSection(id)) {
    return;
  }
  const prepare = ADMIN_HELP_TOUR_PREPARE[id];
  await ctx.host.prepareForTour(prepare);
  ctx.host.markForCheck();
  const postPrepareMs =
    (prepare.expandTriggerIds?.length ?? 0) > 0
      ? ADMIN_HELP_TOUR_TIMING.postPrepareAfterExpandMs
      : ADMIN_HELP_TOUR_TIMING.postPrepareDefaultMs;
  await delayMs(postPrepareMs);
  const highlightSteps = ctx.settingsTabState.buildHighlightSteps(prepare);
  ctx.adminHelpDriverTourService.startHighlightTour(
    { title: section.title, description: section.description },
    highlightSteps
  );
}

export function startAdminPreparedSectionTour(
  section: HelpSection,
  ctx: AdminHelpTourSectionStartContext
): void {
  void runAdminPreparedHighlightTour(section, ctx);
}

function isPreparedAdminTourSection(id: string): id is AdminHelpTourSectionId {
  return id in ADMIN_HELP_TOUR_PREPARE;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
