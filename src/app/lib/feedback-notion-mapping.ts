/**
 * Notion Feedback property mapping for Prayer App Biz Feedback.
 * Data source: collection://ad60c0ea-da0e-4a36-be18-b395c7bcb564
 * Confirmed 2026-09-13. Keep in sync with supabase/functions/submit-feedback/index.ts.
 */

export type FeedbackType = 'bug' | 'feature' | 'suggestion';
export type FeedbackPlatform = 'web' | 'ios' | 'android';

export const DEFAULT_NOTION_FEEDBACK_DATA_SOURCE_ID =
  'ad60c0ea-da0e-4a36-be18-b395c7bcb564';

export const FEEDBACK_TYPE_TO_NOTION: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  suggestion: 'Suggestion',
};

export interface NotionFeedbackMappingInput {
  title: string;
  description: string;
  type: FeedbackType;
  email: string;
  userName?: string;
  pageUrl?: string;
  tenantName?: string;
  tenantSlug?: string;
  platform?: FeedbackPlatform;
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return value === 'bug' || value === 'feature' || value === 'suggestion';
}

export function normalizeFeedbackPlatform(value: unknown): FeedbackPlatform {
  if (value === 'ios' || value === 'android' || value === 'web') {
    return value;
  }
  return 'web';
}

function richText(content: string): { rich_text: Array<{ type: 'text'; text: { content: string } }> } {
  return {
    rich_text: [{ type: 'text', text: { content } }],
  };
}

export function buildNotionFeedbackProperties(
  input: NotionFeedbackMappingInput
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    'Task name': {
      title: [{ type: 'text', text: { content: input.title } }],
    },
    Description: richText(input.description),
    Type: {
      select: { name: FEEDBACK_TYPE_TO_NOTION[input.type] },
    },
    Email: {
      email: input.email,
    },
    Status: {
      status: { name: 'Not started' },
    },
    Priority: {
      select: { name: 'Medium' },
    },
    Platform: {
      select: { name: normalizeFeedbackPlatform(input.platform) },
    },
  };

  const userName = input.userName?.trim();
  if (userName) {
    properties['User name'] = richText(userName.slice(0, 2000));
  }

  const pageUrl = input.pageUrl?.trim();
  if (pageUrl && pageUrl.length <= 2000) {
    properties['Page URL'] = { url: pageUrl };
  }

  const tenantName = input.tenantName?.trim();
  if (tenantName) {
    properties['Tenant'] = richText(tenantName.slice(0, 2000));
  }

  const tenantSlug = input.tenantSlug?.trim();
  if (tenantSlug) {
    properties['Tenant slug'] = richText(tenantSlug.slice(0, 2000));
  }

  return properties;
}

/** Success payload only — never include Notion URLs or secrets. */
export function feedbackSuccessResponse(): { success: true } {
  return { success: true };
}
