import type { AdminHelpTourSectionId } from './admin-help-tour-ids';

/** Snapshot of admin UI visibility for filtering intro / help tours. */
export interface AdminHelpTourVisibilityContext {
  showAnalyticsTab: boolean;
  isChurchTenant: boolean;
  showFeedbackForm: boolean;
  pcoCredentialsConfigured: boolean;
  canWipeChurch: boolean;
}

export function isAdminHelpSectionVisibleInTour(
  id: AdminHelpTourSectionId,
  ctx: AdminHelpTourVisibilityContext
): boolean {
  switch (id) {
    case 'admin_help_analytics':
      return ctx.showAnalyticsTab;
    case 'admin_help_content_memorize_recommendations':
    case 'admin_help_content_verse_week':
    case 'admin_help_integrations_pco':
      return ctx.isChurchTenant;
    case 'admin_help_integrations_pco_lists':
      return ctx.isChurchTenant && ctx.pcoCredentialsConfigured;
    case 'admin_help_tools_feedback':
      return ctx.showFeedbackForm;
    case 'admin_help_security_danger_zone':
      return ctx.canWipeChurch;
    case 'admin_help_approvals':
    case 'admin_help_deletions':
    case 'admin_help_accounts':
    case 'admin_help_content_prayer_encouragement':
    case 'admin_help_content_branding':
    case 'admin_help_content_prompts':
    case 'admin_help_content_prayer_types':
    case 'admin_help_content_recite_mode':
    case 'admin_help_email_subscribers':
    case 'admin_help_email_broadcast':
    case 'admin_help_email_reminders':
    case 'admin_help_email_sending_identity':
    case 'admin_help_email_hourly_memorization':
    case 'admin_help_email_templates':
    case 'admin_help_tools_prayer_editor':
    case 'admin_help_tools_timeline':
    case 'admin_help_tools_booklet':
    case 'admin_help_security_user_management':
    case 'admin_help_security_policies':
      return true;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
