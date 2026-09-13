import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTION_FEEDBACK_DATA_SOURCE_ID,
  buildNotionFeedbackProperties,
  feedbackSuccessResponse,
  isFeedbackType,
  normalizeFeedbackPlatform,
} from './feedback-notion-mapping';

describe('feedback Notion mapping', () => {
  it('maps form types to exact Notion select spellings', () => {
    const bug = buildNotionFeedbackProperties({
      title: 'Crash on save',
      description: 'Tap save and it dies',
      type: 'bug',
      email: 'user@example.com',
    });
    const feature = buildNotionFeedbackProperties({
      title: 'Print duplex',
      description: 'Need duplex',
      type: 'feature',
      email: 'user@example.com',
    });
    const suggestion = buildNotionFeedbackProperties({
      title: 'Darker gold',
      description: 'Gold is bright',
      type: 'suggestion',
      email: 'user@example.com',
    });

    expect((bug.Type as { select: { name: string } }).select.name).toBe('Bug');
    expect((feature.Type as { select: { name: string } }).select.name).toBe('Feature');
    expect((suggestion.Type as { select: { name: string } }).select.name).toBe(
      'Suggestion'
    );
  });

  it('uses server-resolved email and default Status/Priority', () => {
    const properties = buildNotionFeedbackProperties({
      title: 'Title',
      description: 'Description that is actionable',
      type: 'bug',
      email: 'resolved@example.com',
      userName: 'Jane Doe',
      pageUrl: 'https://app.example.com/settings',
      tenantName: 'Cross Pointe',
      tenantSlug: 'cross-pointe',
      platform: 'ios',
    });

    expect((properties.Email as { email: string }).email).toBe('resolved@example.com');
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
    expect(
      (properties['User name'] as { rich_text: Array<{ text: { content: string } }> })
        .rich_text[0].text.content
    ).toBe('Jane Doe');
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
      email: 'user@example.com',
    });
    const serialized = JSON.stringify(properties);
    expect(serialized).not.toMatch(/github_token|NOTION_TOKEN|secret_|ntn_/i);
    expect(serialized).not.toContain('notion.so');
    expect(Object.keys(properties)).not.toContain('url');
  });

  it('success response is only { success: true }', () => {
    expect(feedbackSuccessResponse()).toEqual({ success: true });
    expect(JSON.stringify(feedbackSuccessResponse())).not.toMatch(/token|notion\.so/i);
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
