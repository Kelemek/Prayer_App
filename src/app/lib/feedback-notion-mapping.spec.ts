import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTION_FEEDBACK_DATA_SOURCE_ID,
  buildNotionFeedbackProperties,
  feedbackConfiguredResponse,
  feedbackSuccessResponse,
  isFeedbackType,
  normalizeFeedbackPlatform,
  parseFeedbackConfiguredResponse,
} from './feedback-notion-mapping';

const SUBMISSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('feedback Notion mapping', () => {
  it('maps form types to exact Notion select spellings', () => {
    const bug = buildNotionFeedbackProperties({
      title: 'Crash on save',
      description: 'Tap save and it dies',
      type: 'bug',
      submissionId: SUBMISSION_ID,
    });
    const feature = buildNotionFeedbackProperties({
      title: 'Print duplex',
      description: 'Need duplex',
      type: 'feature',
      submissionId: SUBMISSION_ID,
    });
    const suggestion = buildNotionFeedbackProperties({
      title: 'Darker gold',
      description: 'Gold is bright',
      type: 'suggestion',
      submissionId: SUBMISSION_ID,
    });

    expect((bug.Type as { select: { name: string } }).select.name).toBe('Bug');
    expect((feature.Type as { select: { name: string } }).select.name).toBe('Feature');
    expect((suggestion.Type as { select: { name: string } }).select.name).toBe(
      'Suggestion'
    );
  });

  it('uses Submission ID and omits email and user name from Notion properties', () => {
    const properties = buildNotionFeedbackProperties({
      title: 'Title',
      description: 'Description that is actionable',
      type: 'bug',
      submissionId: SUBMISSION_ID,
      pageUrl: 'https://app.example.com/settings',
      tenantName: 'Cross Pointe',
      tenantSlug: 'cross-pointe',
      platform: 'ios',
    });

    expect(
      (properties['Submission ID'] as { rich_text: Array<{ text: { content: string } }> })
        .rich_text[0].text.content
    ).toBe(SUBMISSION_ID);
    expect(properties).not.toHaveProperty('Email');
    expect(properties).not.toHaveProperty('User name');
    expect((properties.Status as { status: { name: string } }).status.name).toBe(
      'Not started'
    );
    expect((properties.Priority as { select: { name: string } }).select.name).toBe(
      'Medium'
    );
    expect((properties.Platform as { select: { name: string } }).select.name).toBe('ios');
    expect(
      (properties['Task name'] as { title: Array<{ text: { content: string } }> }).title[0]
        .text.content
    ).toBe('Title');
    expect(
      (properties.Description as { rich_text: Array<{ text: { content: string } }> })
        .rich_text[0].text.content
    ).toBe('Description that is actionable');
    expect((properties['Page URL'] as { url: string }).url).toBe(
      'https://app.example.com/settings'
    );
    expect(
      (properties.Tenant as { rich_text: Array<{ text: { content: string } }> }).rich_text[0]
        .text.content
    ).toBe('Cross Pointe');
    expect(
      (properties['Tenant slug'] as { rich_text: Array<{ text: { content: string } }> })
        .rich_text[0].text.content
    ).toBe('cross-pointe');
  });

  it('never includes tokens or Notion URLs in the mapped properties', () => {
    const properties = buildNotionFeedbackProperties({
      title: 'Title',
      description: 'Description',
      type: 'bug',
      submissionId: SUBMISSION_ID,
    });
    const serialized = JSON.stringify(properties);
    expect(serialized).not.toMatch(/github_token|NOTION_TOKEN|secret_|ntn_/i);
    expect(serialized).not.toContain('notion.so');
    expect(serialized).not.toMatch(/@/);
    expect(Object.keys(properties)).not.toContain('url');
  });

  it('success response is only { success: true }', () => {
    expect(feedbackSuccessResponse()).toEqual({ success: true });
    expect(JSON.stringify(feedbackSuccessResponse())).not.toMatch(/token|notion\.so/i);
  });

  it('configured response is only { configured } and never a token', () => {
    expect(feedbackConfiguredResponse(true)).toEqual({ configured: true });
    expect(feedbackConfiguredResponse(false)).toEqual({ configured: false });
    expect(JSON.stringify(feedbackConfiguredResponse(true))).not.toMatch(
      /NOTION_TOKEN|ntn_|secret_/i
    );
  });

  it('hides feedback when the server says it is not configured', () => {
    expect(parseFeedbackConfiguredResponse({ configured: false })).toBe(false);
    expect(
      parseFeedbackConfiguredResponse({
        success: false,
        error: 'Feedback is not configured on the server.',
      })
    ).toBe(false);
    expect(parseFeedbackConfiguredResponse(null, new Response(null, { status: 503 }))).toBe(
      false
    );
  });

  it('shows feedback when configured, and stays visible on unknown status responses', () => {
    expect(parseFeedbackConfiguredResponse({ configured: true })).toBe(true);
    expect(parseFeedbackConfiguredResponse({ success: false, error: 'Title and description are required' })).toBe(
      true
    );
    expect(parseFeedbackConfiguredResponse(null, new Response(null, { status: 405 }))).toBe(
      true
    );
  });

  it('validates types and normalizes platform', () => {
    expect(isFeedbackType('bug')).toBe(true);
    expect(isFeedbackType('Idea')).toBe(false);
    expect(normalizeFeedbackPlatform('android')).toBe('android');
    expect(normalizeFeedbackPlatform('desktop')).toBe('web');
  });

  it('keeps the Biz Feedback data source id (not Cross Pointe or Gospel Site)', () => {
    expect(DEFAULT_NOTION_FEEDBACK_DATA_SOURCE_ID).toBe(
      'ad60c0ea-da0e-4a36-be18-b395c7bcb564'
    );
    expect(DEFAULT_NOTION_FEEDBACK_DATA_SOURCE_ID).not.toBe(
      '53537498-ea76-4f4c-b7f6-38116d48419b'
    );
  });
});
