import { Injectable } from '@angular/core';
import { ADMIN_SETTINGS_TABS, type AdminSettingsTab } from '../lib/admin-settings-tabs';
import type {
  AdminHelpTourHighlightStep,
  AdminHelpTourPrepare,
} from '../lib/admin-help-tour-prepare';

export function adminSettingsTabTourDomId(tab: AdminSettingsTab): string | undefined {
  return ADMIN_SETTINGS_TABS.find((row) => row.id === tab)?.domId;
}

export function adminSettingsTabLabel(tab: AdminSettingsTab): string {
  return ADMIN_SETTINGS_TABS.find((row) => row.id === tab)?.label ?? tab;
}

@Injectable()
export class AdminHelpTourSettingsTabState {
  private lastSettingsTab: AdminSettingsTab | null = null;

  reset(): void {
    this.lastSettingsTab = null;
  }

  /**
   * When the guided tour enters a new Settings sub-tab, prepend a step on that tab button
   * before the section highlights (Analytics already uses the full tab bar on step 1).
   */
  buildHighlightSteps(prepare: AdminHelpTourPrepare): readonly AdminHelpTourHighlightStep[] {
    const tab = prepare.settingsTab;
    const sectionSteps = prepare.highlightSteps;
    if (!tab) {
      return sectionSteps;
    }

    if (sectionSteps[0]?.elementId === 'admin-settings-tabs') {
      this.lastSettingsTab = tab;
      return sectionSteps;
    }

    if (this.lastSettingsTab === tab) {
      return sectionSteps;
    }

    const tabDomId = adminSettingsTabTourDomId(tab);
    if (!tabDomId) {
      this.lastSettingsTab = tab;
      return sectionSteps;
    }

    this.lastSettingsTab = tab;
    const label = adminSettingsTabLabel(tab);
    return [
      {
        elementId: tabDomId,
        popoverSide: 'bottom',
        popoverAlign: 'start',
        title: `${label} tab`,
        description: `You are on the <strong>${label}</strong> tab. The next steps walk through each section on this tab.`,
      },
      ...sectionSteps,
    ];
  }
}
