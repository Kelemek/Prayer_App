import type { AdminTab } from './admin-pending-queues';
import type { AdminSettingsTab } from './admin-settings-tabs';
import { adminCollapsibleTourSectionId } from './admin-help-tour-anchors';
import type { AdminHelpTourSectionId } from './admin-help-tour-ids';

export interface AdminHelpTourHighlightStep {
  elementId: string;
  popoverSide?: 'top' | 'bottom' | 'left' | 'right';
  popoverAlign?: 'start' | 'center' | 'end';
  /** Overrides the help section title for this step only. */
  title?: string;
  /** Overrides the help section description for this step only. */
  description?: string;
}

export interface AdminHelpTourPrepare {
  mainTab: AdminTab;
  settingsTab?: AdminSettingsTab;
  /** Collapsible triggers to expand before highlighting the section root. */
  expandTriggerIds?: readonly string[];
  highlightSteps: readonly AdminHelpTourHighlightStep[];
}

function settingsCollapsible(
  settingsTab: AdminSettingsTab,
  triggerId: string,
  popoverSide: 'top' | 'bottom' = 'bottom'
): AdminHelpTourPrepare {
  return {
    mainTab: 'settings',
    settingsTab,
    expandTriggerIds: [triggerId],
    highlightSteps: [
      {
        elementId: adminCollapsibleTourSectionId(triggerId),
        popoverSide,
        popoverAlign: 'center',
      },
    ],
  };
}

function adminHelpTourPrepareMap(
  map: Record<AdminHelpTourSectionId, AdminHelpTourPrepare>
): Record<AdminHelpTourSectionId, AdminHelpTourPrepare> {
  return map;
}

export const ADMIN_HELP_TOUR_PREPARE = adminHelpTourPrepareMap({
  admin_help_analytics: {
    mainTab: 'settings',
    settingsTab: 'analytics',
    highlightSteps: [
      {
        elementId: 'admin-settings-tabs',
        popoverSide: 'bottom',
        popoverAlign: 'start',
      },
      {
        elementId: 'admin-analytics-stats-card',
        popoverSide: 'bottom',
        popoverAlign: 'center',
      },
      {
        elementId: 'admin-analytics-activity-chart',
        popoverSide: 'top',
        popoverAlign: 'center',
      },
    ],
  },
  admin_help_content_prayer_encouragement: settingsCollapsible(
    'content',
    'prayer-encouragement-settings-trigger'
  ),
  admin_help_content_branding: settingsCollapsible('content', 'app-branding-settings-trigger'),
  admin_help_content_prompts: settingsCollapsible('content', 'prompt-manager-trigger'),
  admin_help_content_prayer_types: settingsCollapsible('content', 'prayer-types-manager-trigger'),
  admin_help_content_memorize_recommendations: settingsCollapsible(
    'content',
    'memorization-recommendations-manager-trigger'
  ),
  admin_help_content_verse_week: settingsCollapsible(
    'content',
    'verse-memorization-prayer-manager-trigger'
  ),
  admin_help_content_recite_mode: settingsCollapsible(
    'content',
    'memorization-recite-settings-trigger'
  ),
  admin_help_email_subscribers: settingsCollapsible('email', 'email-subscribers-trigger'),
  admin_help_email_broadcast: settingsCollapsible(
    'email',
    'admin-subscriber-email-broadcast-trigger'
  ),
  admin_help_email_reminders: settingsCollapsible('email', 'prayer-update-reminders-trigger'),
  admin_help_email_sending_identity: settingsCollapsible('email', 'email-sending-identity-trigger'),
  admin_help_email_hourly_memorization: settingsCollapsible(
    'email',
    'email-hourly-memorization-reminder-settings-trigger'
  ),
  admin_help_email_templates: settingsCollapsible('email', 'email-templates-trigger'),
  admin_help_tools_feedback: settingsCollapsible('tools', 'admin-feedback-trigger'),
  admin_help_tools_prayer_editor: settingsCollapsible('tools', 'prayer-editor-trigger'),
  admin_help_tools_timeline: settingsCollapsible('tools', 'prayer-timeline-trigger'),
  admin_help_tools_booklet: settingsCollapsible('tools', 'prayer-list-booklet-print-trigger'),
  admin_help_security_user_management: settingsCollapsible(
    'security',
    'admin-user-management-trigger'
  ),
  admin_help_security_policies: settingsCollapsible(
    'security',
    'security-policy-settings-trigger'
  ),
  admin_help_security_danger_zone: {
    mainTab: 'settings',
    settingsTab: 'security',
    highlightSteps: [
      {
        elementId: 'admin-danger-zone-panel',
        popoverSide: 'top',
        popoverAlign: 'center',
      },
    ],
  },
  admin_help_integrations_pco: settingsCollapsible(
    'integrations',
    'planning-center-connect-trigger'
  ),
  admin_help_integrations_pco_lists: settingsCollapsible(
    'integrations',
    'planning-center-list-mapper-trigger'
  ),
  admin_help_approvals: {
    mainTab: 'prayers',
    highlightSteps: [
      { elementId: 'admin-nav-tab-prayers', popoverSide: 'bottom', popoverAlign: 'center' },
      { elementId: 'admin-approvals-panel', popoverSide: 'top', popoverAlign: 'center' },
    ],
  },
  admin_help_deletions: {
    mainTab: 'deletions',
    highlightSteps: [
      { elementId: 'admin-nav-tab-deletions', popoverSide: 'bottom', popoverAlign: 'center' },
      { elementId: 'admin-deletions-panel', popoverSide: 'top', popoverAlign: 'center' },
    ],
  },
  admin_help_accounts: {
    mainTab: 'accounts',
    highlightSteps: [
      { elementId: 'admin-nav-tab-accounts', popoverSide: 'bottom', popoverAlign: 'center' },
      { elementId: 'admin-accounts-panel', popoverSide: 'top', popoverAlign: 'center' },
    ],
  },
});
