import { describe, expect, it } from 'vitest';
import { markdownToPlainText, markdownToSafeHtml } from './markdown';

describe('markdownToPlainText', () => {
  it('returns empty string for null/undefined/empty input', () => {
    expect(markdownToPlainText(null)).toBe('');
    expect(markdownToPlainText(undefined)).toBe('');
    expect(markdownToPlainText('')).toBe('');
  });

  it('strips bold, italic, strikethrough, and TipTap ++underline++ markers', () => {
    expect(markdownToPlainText('**bold** and *italic* and ~~strike~~')).toBe(
      'bold and italic and strike'
    );
    expect(markdownToPlainText('++under++')).toBe('under');
  });

  it('strips list markers and headings', () => {
    const input = `# Heading\n\n- item one\n- item two\n\n1. first\n2. second`;
    const output = markdownToPlainText(input);
    expect(output).toContain('Heading');
    expect(output).toContain('item one');
    expect(output).toContain('first');
    expect(output).not.toContain('#');
    expect(output).not.toContain('- ');
    expect(output).not.toMatch(/^\d+\.\s/m);
  });

  it('strips link syntax but keeps visible text', () => {
    expect(markdownToPlainText('Visit [Google](https://google.com) now.')).toBe(
      'Visit Google now.'
    );
  });

  it('strips inline code and code fences', () => {
    const input = 'Run `npm install` or\n```\nnpm ci\n```';
    const output = markdownToPlainText(input);
    expect(output).toContain('npm install');
    expect(output).toContain('npm ci');
    expect(output).not.toContain('`');
  });

  it('strips blockquote markers', () => {
    expect(markdownToPlainText('> quoted line')).toBe('quoted line');
  });
});

describe('markdownToSafeHtml', () => {
  it('returns empty string for null/undefined/empty input', () => {
    expect(markdownToSafeHtml(null)).toBe('');
    expect(markdownToSafeHtml(undefined)).toBe('');
    expect(markdownToSafeHtml('')).toBe('');
  });

  it('converts basic markdown to HTML', () => {
    const html = markdownToSafeHtml('**bold** *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders TipTap ++underline++ as underline', () => {
    const html = markdownToSafeHtml('++underscored++');
    expect(html).toContain('<u');
    expect(html).toContain('underscored');
    expect(html).toContain('text-decoration: underline');
  });

  it('renders lists', () => {
    const html = markdownToSafeHtml('- one\n- two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
  });

  it('strips disallowed tags like script', () => {
    const html = markdownToSafeHtml('<script>alert(1)</script>Hello');
    expect(html).not.toContain('<script');
    expect(html).toContain('Hello');
  });

  it('rewrites links to open in a new tab with safe rel', () => {
    const html = markdownToSafeHtml('[link](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips javascript: hrefs', () => {
    const html = markdownToSafeHtml('[bad](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('inlines blockquote styling so email clients render the left border', () => {
    const html = markdownToSafeHtml('> quoted line');
    expect(html).toContain('<blockquote');
    expect(html).toContain('border-left');
    expect(html).toContain('rgba(57, 112, 77, 0.5)');
  });
});
