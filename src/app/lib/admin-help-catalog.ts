import type { HelpSection, HelpSectionInput } from '../types/help-content';
import type { AdminHelpTourSectionId, AdminIntroTourSectionId } from './admin-help-tour-ids';

type AdminHelpCatalogRow = HelpSectionInput & {
  id: AdminHelpTourSectionId;
  /** Included in first-visit intro and **Take the guided tour** on Admin. */
  includeInIntroTour?: boolean;
};

const CHART_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';

const CONTENT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

const EMAIL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';

const TOOLS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

const SECURITY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

const INTEGRATIONS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>';

const QUEUE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>';

export const ADMIN_HELP_SECTIONS_IN_DISPLAY_ORDER: readonly AdminHelpCatalogRow[] = [
  {
    id: 'admin_help_analytics',
    includeInIntroTour: true,
    title: 'Site analytics',
    description: 'Page views, prayer counts, and memorization stats for your organization.',
    icon: CHART_ICON,
    content: [
      {
        subtitle: 'When you see it',
        text: 'Analytics appears for church plans and for platform super admins. Open Settings → Analytics to review engagement over time.',
      },
    ],
  },
  {
    id: 'admin_help_content_prayer_encouragement',
    includeInIntroTour: true,
    title: 'Prayer encouragement (Pray For)',
    description: 'Cooldown and messaging when members tap Pray For on a request.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Church experience',
        text: 'Configure how often someone can send encouragement and what members see when they pray for a card.',
      },
    ],
  },
  {
    id: 'admin_help_content_branding',
    includeInIntroTour: true,
    title: 'Branding',
    description: 'Logo, colors, and church identity on the public site.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Make it yours',
        text: 'Upload artwork and set accent colors so the prayer wall matches your church.',
      },
    ],
  },
  {
    id: 'admin_help_content_prompts',
    includeInIntroTour: true,
    title: 'Prayer prompts',
    description: 'Curated prompts that appear on the Church tab.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Prompt library',
        text: 'Add, edit, or retire prompts to guide congregational prayer.',
      },
    ],
  },
  {
    id: 'admin_help_content_prayer_types',
    includeInIntroTour: true,
    title: 'Prayer types',
    description: 'Categories and filters for church prayer requests.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Organize requests',
        text: 'Types power filters on the home page and help members find related prayers.',
      },
    ],
  },
  {
    id: 'admin_help_content_memorize_recommendations',
    includeInIntroTour: true,
    title: 'Memorization recommendations',
    description: 'Suggested verses for your congregation (church plans).',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Church library',
        text: 'Recommend passages members can add to their private memorize list.',
      },
    ],
  },
  {
    id: 'admin_help_content_verse_week',
    includeInIntroTour: true,
    title: 'Verse of the week',
    description: 'Featured scripture tied to church prayer content.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Weekly focus',
        text: 'Publish a verse that appears alongside church prayer experiences.',
      },
    ],
  },
  {
    id: 'admin_help_content_recite_mode',
    includeInIntroTour: true,
    title: 'Recite mode',
    description: 'Defaults for memorization recitation in the app.',
    icon: CONTENT_ICON,
    content: [
      {
        subtitle: 'Practice settings',
        text: 'Control how recite mode behaves for members learning verses.',
      },
    ],
  },
  {
    id: 'admin_help_email_subscribers',
    includeInIntroTour: true,
    title: 'Email subscribers',
    description: 'Who receives church email digests and notifications.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Audience',
        text: 'Review subscriber lists and manage who gets organization email.',
      },
    ],
  },
  {
    id: 'admin_help_email_broadcast',
    includeInIntroTour: true,
    title: 'Subscriber broadcast',
    description: 'Send a one-off email to subscribers.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Announcements',
        text: 'Compose subject and body for a broadcast; use responsibly for important updates.',
      },
    ],
  },
  {
    id: 'admin_help_email_reminders',
    includeInIntroTour: true,
    title: 'Prayer update reminders',
    description: 'Email nudges when prayers need fresh updates.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Stay current',
        text: 'Configure reminder templates and timing for prayer update emails.',
      },
    ],
  },
  {
    id: 'admin_help_email_sending_identity',
    includeInIntroTour: true,
    title: 'Sending identity',
    description: 'From name, reply-to, and deliverability for church email.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Trust in the inbox',
        text: 'Set the identity members see when your church sends mail.',
      },
    ],
  },
  {
    id: 'admin_help_email_hourly_memorization',
    includeInIntroTour: true,
    title: 'Hourly memorization reminder',
    description: 'Template for users who opt into memorization email nudges.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Template choice',
        text: 'Pick a simple nudge or a spotlight email that highlights the verse needing practice.',
      },
    ],
  },
  {
    id: 'admin_help_email_templates',
    includeInIntroTour: true,
    title: 'Email templates',
    description: 'Transactional and notification templates for your tenant.',
    icon: EMAIL_ICON,
    content: [
      {
        subtitle: 'Customize copy',
        text: 'Edit system emails such as approvals, invites, and prayer notifications.',
      },
    ],
  },
  {
    id: 'admin_help_tools_feedback',
    includeInIntroTour: true,
    title: 'Send feedback',
    description: 'Contact the Prayer App team from Admin.',
    icon: TOOLS_ICON,
    content: [
      {
        subtitle: 'When available',
        text: 'If feedback is configured for your environment, use this form for bugs and ideas.',
      },
    ],
  },
  {
    id: 'admin_help_tools_prayer_editor',
    includeInIntroTour: true,
    title: 'Prayer editor',
    description: 'Search and edit live prayer requests as an admin.',
    icon: TOOLS_ICON,
    content: [
      {
        subtitle: 'Moderation',
        text: 'Find a request quickly and fix typos or sensitive details without leaving Admin.',
      },
    ],
  },
  {
    id: 'admin_help_tools_timeline',
    includeInIntroTour: true,
    title: 'Prayer archive timeline',
    description: 'Historical view of answered and archived prayers.',
    icon: TOOLS_ICON,
    content: [
      {
        subtitle: 'Look back',
        text: 'Browse when prayers were answered or archived for reporting and storytelling.',
      },
    ],
  },
  {
    id: 'admin_help_tools_booklet',
    includeInIntroTour: true,
    title: 'Booklet print',
    description: 'Print formatted prayer lists for gatherings.',
    icon: TOOLS_ICON,
    content: [
      {
        subtitle: 'Sunday-ready',
        text: 'Generate a booklet layout from current church prayers for services or small groups.',
      },
    ],
  },
  {
    id: 'admin_help_security_user_management',
    includeInIntroTour: true,
    title: 'Admin users and invites',
    description: 'Invite members, assign admins, and manage access.',
    icon: SECURITY_ICON,
    content: [
      {
        subtitle: 'People and roles',
        text: 'Create invite links, resend email, and promote trusted leaders to admin.',
      },
    ],
  },
  {
    id: 'admin_help_security_policies',
    includeInIntroTour: true,
    title: 'Security policies',
    description: 'Whether members may delete or update prayers without approval.',
    icon: SECURITY_ICON,
    content: [
      {
        subtitle: 'Guardrails',
        text: 'Tighten or relax self-service edits based on how your church moderates content.',
      },
    ],
  },
  {
    id: 'admin_help_security_danger_zone',
    includeInIntroTour: true,
    title: 'Danger zone',
    description: 'Permanently delete the church organization.',
    icon: SECURITY_ICON,
    content: [
      {
        subtitle: 'Irreversible',
        text: 'Only tenant admins and super admins see this. Members keep personal accounts; church data is removed.',
      },
    ],
  },
  {
    id: 'admin_help_integrations_pco',
    includeInIntroTour: true,
    title: 'Planning Center',
    description: 'Connect Planning Center Online for lists and people sync.',
    icon: INTEGRATIONS_ICON,
    content: [
      {
        subtitle: 'Church plans',
        text: 'Add API credentials to link your Planning Center account.',
      },
    ],
  },
  {
    id: 'admin_help_integrations_pco_lists',
    includeInIntroTour: true,
    title: 'Planning Center list mapping',
    description: 'Map PCO lists to Prayer App groups or audiences.',
    icon: INTEGRATIONS_ICON,
    content: [
      {
        subtitle: 'After connect',
        text: 'Once credentials are saved, map lists so the right people receive the right content.',
      },
    ],
  },
  {
    id: 'admin_help_approvals',
    title: 'Approvals queue',
    description: 'Review new prayers and updates before they go live.',
    icon: QUEUE_ICON,
    content: [
      {
        subtitle: 'First stop',
        text: 'The Approvals tile shows pending items. Approve, deny, or edit before members see requests on the wall.',
      },
    ],
  },
  {
    id: 'admin_help_deletions',
    title: 'Deletion requests',
    description: 'Moderate requests to remove prayers or updates.',
    icon: QUEUE_ICON,
    content: [
      {
        subtitle: 'Pending deletions',
        text: 'Members may ask to delete content; confirm or deny each request here.',
      },
    ],
  },
  {
    id: 'admin_help_accounts',
    title: 'Account requests',
    description: 'Approve new users who need access to your church.',
    icon: QUEUE_ICON,
    content: [
      {
        subtitle: 'New signups',
        text: 'When registration requires approval, review and accept or deny account requests.',
      },
    ],
  },
];

export function adminIntroTourSectionIdsFromCatalog(): readonly AdminIntroTourSectionId[] {
  const ids: AdminIntroTourSectionId[] = [];
  for (const row of ADMIN_HELP_SECTIONS_IN_DISPLAY_ORDER) {
    if (row.includeInIntroTour === true) {
      ids.push(row.id as AdminIntroTourSectionId);
    }
  }
  return ids;
}

export function adminHelpSectionsFromCatalog(now: Date): HelpSection[] {
  return ADMIN_HELP_SECTIONS_IN_DISPLAY_ORDER.map((row, index) => ({
    ...row,
    order: index + 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
  }));
}
