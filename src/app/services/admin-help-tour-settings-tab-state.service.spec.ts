import { describe, it, expect, beforeEach } from 'vitest';
import { AdminHelpTourSettingsTabState } from './admin-help-tour-settings-tab-state.service';

describe('AdminHelpTourSettingsTabState', () => {
  let state: AdminHelpTourSettingsTabState;

  beforeEach(() => {
    state = new AdminHelpTourSettingsTabState();
  });

  it('prepends a tab button step when entering a new settings tab', () => {
    const analytics = state.buildHighlightSteps({
      mainTab: 'settings',
      settingsTab: 'analytics',
      highlightSteps: [
        { elementId: 'admin-settings-tabs' },
        { elementId: 'admin-analytics-stats-card' },
      ],
    });
    expect(analytics.map((s) => s.elementId)).toEqual([
      'admin-settings-tabs',
      'admin-analytics-stats-card',
    ]);

    const content = state.buildHighlightSteps({
      mainTab: 'settings',
      settingsTab: 'content',
      highlightSteps: [{ elementId: 'prayer-encouragement-settings-section' }],
    });
    expect(content.map((s) => s.elementId)).toEqual([
      'admin-settings-tab-content',
      'prayer-encouragement-settings-section',
    ]);
  });

  it('does not repeat the tab step for another section on the same tab', () => {
    state.buildHighlightSteps({
      mainTab: 'settings',
      settingsTab: 'content',
      highlightSteps: [{ elementId: 'a' }],
    });
    const second = state.buildHighlightSteps({
      mainTab: 'settings',
      settingsTab: 'content',
      highlightSteps: [{ elementId: 'b' }],
    });
    expect(second.map((s) => s.elementId)).toEqual(['b']);
  });
});
