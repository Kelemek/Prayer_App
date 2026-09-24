import { describe, expect, it } from 'vitest';
import { buildBookletPromptBatchHtml } from './print-booklet-prompt-batch';

describe('buildBookletPromptBatchHtml', () => {
  it('renders type heading and prompt cards in two columns', () => {
    const html = buildBookletPromptBatchHtml(
      'Morning',
      [{ title: 'Prompt A' }, { title: 'Prompt B' }],
      { continued: false, totalCountInType: 2 }
    );
    expect(html).toContain('Morning Prompts (2)');
    expect(html).toContain('booklet-prompt-print-root');
    expect(html).toContain('Prompt A');
    expect(html).toContain('Prompt B');
    expect(html).not.toContain('continued');
  });

  it('uses continued note when batch is a continuation', () => {
    const html = buildBookletPromptBatchHtml(
      'Evening',
      [{ title: 'More' }],
      { continued: true, totalCountInType: 5 }
    );
    expect(html).toContain('booklet-prompt-continued-note');
    expect(html).not.toContain('Evening Prompts');
  });
});
