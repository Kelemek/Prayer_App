import { describe, it, expect } from 'vitest';
import { dispatchAdminHelpSectionTour, isAdminHelpTourSectionId } from './admin-help-tour-dispatch';
import type { HelpSection } from '../types/help-content';

describe('admin-help-tour-dispatch', () => {
  it('recognizes admin tour ids', () => {
    expect(isAdminHelpTourSectionId('admin_help_analytics')).toBe(true);
    expect(isAdminHelpTourSectionId('help_prayers')).toBe(false);
  });

  it('returns false for unknown ids', () => {
    const section: HelpSection = {
      id: 'not_admin',
      title: 'x',
      description: 'y',
      icon: '',
      content: [],
      order: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
    };
    expect(
      dispatchAdminHelpSectionTour(section, {
        host: {} as never,
        adminHelpDriverTourService: {} as never,
        settingsTabState: {} as never,
      })
    ).toBe(false);
  });
});
