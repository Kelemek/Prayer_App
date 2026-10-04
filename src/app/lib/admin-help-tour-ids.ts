/** Settings walk order for first-time intro and **Take the guided tour** (no queue tabs). */
export const ADMIN_INTRO_TOUR_SECTION_IDS = [
  'admin_help_analytics',
  'admin_help_content_prayer_encouragement',
  'admin_help_content_branding',
  'admin_help_content_prompts',
  'admin_help_content_prayer_types',
  'admin_help_content_memorize_recommendations',
  'admin_help_content_verse_week',
  'admin_help_content_recite_mode',
  'admin_help_email_subscribers',
  'admin_help_email_broadcast',
  'admin_help_email_reminders',
  'admin_help_email_sending_identity',
  'admin_help_email_hourly_memorization',
  'admin_help_email_templates',
  'admin_help_tools_feedback',
  'admin_help_tools_prayer_editor',
  'admin_help_tools_timeline',
  'admin_help_tools_booklet',
  'admin_help_security_user_management',
  'admin_help_security_policies',
  'admin_help_security_danger_zone',
  'admin_help_integrations_pco',
  'admin_help_integrations_pco_lists',
] as const;

export type AdminIntroTourSectionId = (typeof ADMIN_INTRO_TOUR_SECTION_IDS)[number];

export const ADMIN_QUEUE_HELP_TOUR_SECTION_IDS = [
  'admin_help_approvals',
  'admin_help_deletions',
  'admin_help_accounts',
] as const;

export type AdminQueueHelpTourSectionId = (typeof ADMIN_QUEUE_HELP_TOUR_SECTION_IDS)[number];

export const ADMIN_HELP_TOUR_SECTION_IDS = [
  ...ADMIN_INTRO_TOUR_SECTION_IDS,
  ...ADMIN_QUEUE_HELP_TOUR_SECTION_IDS,
] as const;

export type AdminHelpTourSectionId = (typeof ADMIN_HELP_TOUR_SECTION_IDS)[number];

const ADMIN_HELP_TOUR_SECTION_ID_SET: ReadonlySet<string> = new Set(ADMIN_HELP_TOUR_SECTION_IDS);

export function isAdminHelpTourSectionId(id: string): id is AdminHelpTourSectionId {
  return ADMIN_HELP_TOUR_SECTION_ID_SET.has(id);
}
