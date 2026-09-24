import { describe, expect, it } from 'vitest';
import {
  estimateBookletPromptBatchWeight,
  estimateBookletPromptTitleWeight,
  getPrintPromptTypeColor,
  getPrintPromptTypeColors,
  getPrintablePromptBlockStyles,
  sortPromptsAlphabeticalByTitle,
  splitPromptsIntoTwoColumnsRowMajor,
} from './print-prompt-layout';

describe('print-prompt-layout', () => {
  it('getPrintPromptTypeColor uses palette or fallback', () => {
    expect(getPrintPromptTypeColors().Praise).toBeTruthy();
    expect(getPrintPromptTypeColor('Praise')).toBe('#39704D');
    expect(getPrintPromptTypeColor('Other')).toBe('#6b7280');
  });

  it('getPrintablePromptBlockStyles supports scoped root and responsive flag', () => {
    const base = getPrintablePromptBlockStyles();
    expect(base).toContain('.prompt-item');
    const scoped = getPrintablePromptBlockStyles({
      scopedRoot: '.booklet-root',
      includeStandaloneResponsive: true,
    });
    expect(scoped).toContain('.booklet-root .prompt-text');
    expect(scoped).toContain('max-width: 768px');
  });

  it('sorts and splits prompts for print columns', () => {
    const sorted = sortPromptsAlphabeticalByTitle([
      { title: 'Beta' },
      { title: 'alpha' },
    ]);
    expect(sorted[0]?.title).toBe('alpha');
    const { col1, col2 } = splitPromptsIntoTwoColumnsRowMajor([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(col1).toHaveLength(2);
    expect(col2).toHaveLength(1);
  });

  it('estimates booklet prompt weights', () => {
    expect(estimateBookletPromptTitleWeight('Hi')).toBeGreaterThan(0);
    expect(
      estimateBookletPromptBatchWeight([{ title: 'A' }, { title: 'B' }])
    ).toBeGreaterThan(estimateBookletPromptTitleWeight('A'));
  });
});
