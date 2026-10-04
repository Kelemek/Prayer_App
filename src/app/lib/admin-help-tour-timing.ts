/** Shared delays for admin help tour orchestration (launcher, prepare, host adapter). */
export const ADMIN_HELP_TOUR_TIMING = {
  launcherStartDelayMs: 280,
  introStepGapMs: 200,
  postPrepareDefaultMs: 200,
  postPrepareAfterExpandMs: 320,
  driverStartSettleMs: 120,
  host: {
    collapseSettleMs: 220,
    preparePaintMs: 80,
    settingsTabSettleMs: 360,
    expandOpenTimeoutMs: 4000,
    preparePaintAfterExpandMs: 420,
    highlightSettleAfterExpandMs: 280,
    sectionContentTimeoutMs: 15000,
  },
} as const;
