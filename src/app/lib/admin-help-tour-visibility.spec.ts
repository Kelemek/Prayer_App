import { describe, it, expect } from 'vitest';
import { isAdminHelpSectionVisibleInTour } from './admin-help-tour-visibility';

const base = {
  showAnalyticsTab: true,
  isChurchTenant: true,
  showFeedbackForm: true,
  pcoCredentialsConfigured: true,
  canWipeChurch: true,
};

describe('isAdminHelpSectionVisibleInTour', () => {
  it('hides analytics when tab is unavailable', () => {
    expect(
      isAdminHelpSectionVisibleInTour('admin_help_analytics', {
        ...base,
        showAnalyticsTab: false,
      })
    ).toBe(false);
  });

  it('hides church-only sections for non-church tenants', () => {
    expect(
      isAdminHelpSectionVisibleInTour('admin_help_integrations_pco', {
        ...base,
        isChurchTenant: false,
      })
    ).toBe(false);
  });

  it('hides PCO list mapping until credentials exist', () => {
    expect(
      isAdminHelpSectionVisibleInTour('admin_help_integrations_pco_lists', {
        ...base,
        pcoCredentialsConfigured: false,
      })
    ).toBe(false);
  });
});
