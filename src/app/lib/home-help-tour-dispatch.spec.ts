import { describe, expect, it, vi } from 'vitest';
import {
  dispatchHomeHelpSectionTour,
  HOME_HELP_TOUR_SECTION_IDS,
  isHomeHelpTourSectionId,
} from './home-help-tour-dispatch';

vi.mock('./home-help-tour-section-starts', () => ({
  startCreatingPrayersTour: vi.fn(),
  startFilteringTour: vi.fn(),
  startPrayerPromptsTour: vi.fn(),
  startPrayerEncouragementTour: vi.fn(),
  startSearchPrayersTour: vi.fn(),
  startPersonalPrayersTour: vi.fn(),
  startMemorizeTour: vi.fn(),
  startPrintingTour: vi.fn(),
  startEmailSubscriptionTour: vi.fn(),
  startPrayerRemindersTour: vi.fn(),
  startFeedbackTour: vi.fn(),
  startAppSettingsTour: vi.fn(),
  startPresentationModeTour: vi.fn(),
}));

import * as sectionStarts from './home-help-tour-section-starts';

describe('home-help-tour-dispatch', () => {
  const section = { id: 'help_filtering', title: 'T', description: 'D' };
  const ctx = { host: {} as never, helpDriverTourService: {} as never };

  it('isHomeHelpTourSectionId recognizes configured ids', () => {
    expect(isHomeHelpTourSectionId('help_filtering')).toBe(true);
    expect(isHomeHelpTourSectionId('unknown')).toBe(false);
    expect(HOME_HELP_TOUR_SECTION_IDS).toContain('help_memorize');
  });

  it('dispatchHomeHelpSectionTour routes known sections', () => {
    expect(dispatchHomeHelpSectionTour(section, ctx)).toBe(true);
    expect(sectionStarts.startFilteringTour).toHaveBeenCalledWith(section, ctx);
  });

  it('dispatchHomeHelpSectionTour covers every help section id', () => {
    for (const id of HOME_HELP_TOUR_SECTION_IDS) {
      vi.clearAllMocks();
      const ok = dispatchHomeHelpSectionTour(
        { id, title: 'T', description: 'D' },
        ctx
      );
      expect(ok).toBe(true);
    }
  });

  it('dispatchHomeHelpSectionTour returns false for unknown ids', () => {
    expect(
      dispatchHomeHelpSectionTour({ id: 'nope', title: 'T', description: 'D' }, ctx)
    ).toBe(false);
  });
});
