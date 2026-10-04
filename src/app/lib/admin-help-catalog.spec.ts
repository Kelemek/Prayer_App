import { describe, it, expect } from 'vitest';
import { ADMIN_INTRO_TOUR_SECTION_IDS } from './admin-help-tour-ids';
import { adminIntroTourSectionIdsFromCatalog } from './admin-help-catalog';

describe('admin-help-catalog', () => {
  it('intro tour section order matches catalog includeInIntroTour rows', () => {
    expect(adminIntroTourSectionIdsFromCatalog()).toEqual([...ADMIN_INTRO_TOUR_SECTION_IDS]);
  });
});
