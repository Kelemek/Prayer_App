import { describe, expect, it } from 'vitest';
import {
  buildPrayerUpdateBlockHtml,
  buildSpotlightEmailTemplateVars,
  escapeHtml,
  markdownToPlainText,
  markdownToSafeHtml,
  truncateText,
} from './edge-email-markdown';

describe('edge-email-markdown', () => {
  it('markdownToSafeHtml sanitizes script injection', () => {
    const html = markdownToSafeHtml('Hello <script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('Hello');
  });

  it('markdownToSafeHtml allows safe links and strips javascript:', () => {
    const html = markdownToSafeHtml('[ok](https://example.com) [bad](javascript:alert(1))');
    expect(html).toContain('https://example.com');
    expect(html).not.toContain('javascript:');
  });

  it('markdownToPlainText strips markdown syntax', () => {
    expect(markdownToPlainText('**bold**')).toContain('bold');
  });

  it('escapeHtml escapes special characters', () => {
    expect(escapeHtml('<a & ">')).toBe('&lt;a &amp; &quot;&gt;');
  });

  it('truncateText respects max length with ellipsis', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcd…');
    expect(truncateText('abc', 10)).toBe('abc');
  });

  it('buildPrayerUpdateBlockHtml wraps content', () => {
    expect(buildPrayerUpdateBlockHtml('<p>Hi</p>')).toContain('Hi');
  });

  it('markdownToSafeHtml renders lists, images, and blockquotes safely', () => {
    const html = markdownToSafeHtml(
      '> quote\n\n- one\n\n![alt](https://cdn.example/x.png)\n\n![bad](javascript:x)'
    );
    expect(html).toContain('blockquote');
    expect(html).toContain('<ul');
    expect(html).toContain('https://cdn.example/x.png');
    expect(html).not.toContain('javascript:');
  });

  it('buildSpotlightEmailTemplateVars handles null spotlight', () => {
    const vars = buildSpotlightEmailTemplateVars('https://app.example', null, '');
    expect(vars.variablesText.spotlightPrayerTitle).toBe('');
    expect(vars.variablesHtml.spotlightPrayerTitle).toBe('');
  });

  it('buildSpotlightEmailTemplateVars fills spotlight fields', () => {
    const vars = buildSpotlightEmailTemplateVars(
      'https://app.example',
      {
        kindLabel: 'Current',
        title: 'Healing',
        prayerFor: 'John',
        requester: 'Jane',
        description: 'Please pray',
      },
      '**Update**'
    );
    expect(vars.variablesText.spotlightPrayerTitle).toBe('Healing');
    expect(vars.variablesHtml.spotlightPrayerTitle).toContain('Healing');
  });

  it('markdownToSafeHtml returns empty for nullish input', () => {
    expect(markdownToSafeHtml(null)).toBe('');
    expect(markdownToSafeHtml(undefined)).toBe('');
  });

  it('markdownToSafeHtml allows relative image paths and strips unsafe tags', () => {
    const html = markdownToSafeHtml(
      '![local](/assets/logo.png)\n\n<iframe src="evil"></iframe>\n\n`code`'
    );
    expect(html).toContain('/assets/logo.png');
    expect(html).not.toContain('iframe');
    expect(html).toContain('code');
  });

  it('buildPrayerUpdateBlockHtml returns empty for blank update', () => {
    expect(buildPrayerUpdateBlockHtml('')).toBe('');
  });

  it('buildSpotlightEmailTemplateVars includes update sections when markdown provided', () => {
    const vars = buildSpotlightEmailTemplateVars(
      'https://app.example',
      {
        kindLabel: 'Current',
        title: 'Title',
        prayerFor: 'For',
        requester: 'Req',
        description: 'Desc',
      },
      '**Bold update**'
    );
    expect(vars.variablesText.spotlightUpdateTextSection).toContain('Bold update');
    expect(vars.variablesHtml.spotlightUpdateBlockHtml).toContain('Update');
  });
});
