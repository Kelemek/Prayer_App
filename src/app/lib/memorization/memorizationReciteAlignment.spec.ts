import { describe, it, expect } from 'vitest';
import {
  alignRecitation,
  buildReciteDisplaySegments,
  normalizeReciteWord,
  reciteScorePercent,
  tokenizeReciteTranscript,
  type ReciteAlignmentResult,
} from './memorizationReciteAlignment';
import {
  buildMemorizationTokens,
  getTypableTokenIndices,
} from './memorizationPracticeUtils';
import { isSingleVerseScriptureReference } from './parse-scripture-reference';

describe('parse-scripture-reference single verse', () => {
  it('isSingleVerseScriptureReference', () => {
    expect(isSingleVerseScriptureReference('John 3:16')).toBe(true);
    expect(isSingleVerseScriptureReference('John 3:16-18')).toBe(false);
    expect(isSingleVerseScriptureReference('Psalm 23')).toBe(false);
    expect(isSingleVerseScriptureReference('Genesis 1:1')).toBe(true);
    expect(isSingleVerseScriptureReference('Genesis 1:1-3')).toBe(false);
  });
});

describe('memorizationReciteAlignment', () => {
  const tokens = buildMemorizationTokens(
    'For God so loved the world',
    'John 3:16'
  );
  const typable = getTypableTokenIndices(tokens);

  it('normalizeReciteWord handles punctuation and number words', () => {
    expect(normalizeReciteWord("don't")).toBe('dont');
    expect(normalizeReciteWord('Three')).toBe('3');
    expect(tokenizeReciteTranscript('John three sixteen')).toEqual(['john', '3', '16']);
    expect(tokenizeReciteTranscript('John 3:16')).toEqual(['john', '3', '16']);
    expect(tokenizeReciteTranscript('Romans 8:28')).toEqual(['romans', '8', '28']);
    expect(tokenizeReciteTranscript('Romans 8 twenty eight')).toEqual(['romans', '8', '28']);
    expect(tokenizeReciteTranscript('Romans 8 twenty-eight')).toEqual(['romans', '8', '28']);
    expect(tokenizeReciteTranscript('Romans 8 to eight')).toEqual(['romans', '8', '28']);
  });

  it('buildReciteDisplaySegments groups verse digits but not chapter:verse', () => {
    const romansTokens = buildMemorizationTokens(
      'And we know that all things work together for good, for those who are called according to his purpose.',
      'Romans 8:28'
    );
    const segments = buildReciteDisplaySegments(romansTokens);
    expect(segments.some((s) => s.kind === 'digits' && s.text === '28')).toBe(true);
    expect(segments.filter((s) => s.kind === 'digits' && s.text === '2').length).toBe(0);

    const johnTokens = buildMemorizationTokens('For God so loved the world', 'John 3:16');
    const johnSegments = buildReciteDisplaySegments(johnTokens);
    expect(johnSegments.some((s) => s.kind === 'digits' && s.text === '16')).toBe(true);
    expect(johnSegments.some((s) => s.kind === 'digits' && s.text === '3')).toBe(true);
  });

  it('aligns transcript when STT combines verse digits', () => {
    for (const transcript of [
      'For God so loved the world John 3 16',
      'For God so loved the world John 3 sixteen',
      'For God so loved the world John three sixteen',
      'For God so loved the world John 3:16',
    ]) {
      const summary = alignRecitation(tokens, typable, transcript, 'John 3:16');
      expect(summary.correctCount, transcript).toBe(typable.length);
      expect(summary.missingCount, transcript).toBe(0);
      expect(summary.wrongCount, transcript).toBe(0);
    }
  });

  it('aligns exact transcript including reference digits', () => {
    const summary = alignRecitation(
      tokens,
      typable,
      'For God so loved the world John 3 1 6',
      'John 3:16'
    );
    expect(summary.correctCount).toBe(typable.length);
    expect(summary.missingCount).toBe(0);
    expect(summary.wrongCount).toBe(0);
    expect(reciteScorePercent(summary)).toBe(100);
  });

  it('marks missing words', () => {
    const summary = alignRecitation(tokens, typable, 'For God loved', 'John 3:16');
    expect(summary.missingCount).toBeGreaterThan(0);
    expect(summary.correctCount).toBeGreaterThan(0);
  });

  it('handles empty transcript', () => {
    const summary = alignRecitation(tokens, typable, '', 'John 3:16');
    expect(summary.missingCount).toBe(typable.length);
    expect(summary.correctCount).toBe(0);
  });

  describe('reference digit strictness', () => {
    const romansTokens = buildMemorizationTokens(
      'And we know that all things work together for good',
      'Romans 8:28'
    );
    const romansTypable = getTypableTokenIndices(romansTokens);

    function referenceDigitStatuses(
      summary: ReturnType<typeof alignRecitation>
    ): ReciteAlignmentResult[] {
      const refStart = romansTypable.length - 4;
      return summary.results.filter((r) => {
        const pos = romansTypable.indexOf(r.tokenIndex);
        return pos >= refStart;
      });
    }

    it('marks wrong verse numbers as incorrect (Romans 8:28)', () => {
      for (const transcript of [
        'And we know that all things work together for good Romans 8:29',
        'And we know that all things work together for good Romans 8:26',
      ]) {
        const summary = alignRecitation(romansTokens, romansTypable, transcript, 'Romans 8:28');
        const refDigits = referenceDigitStatuses(summary);
        const verseTens = refDigits.find((r) => romansTokens[r.tokenIndex]?.text === '2');
        const verseOnes = refDigits.find((r) => {
          const idx = romansTypable.indexOf(r.tokenIndex);
          return romansTokens[r.tokenIndex]?.text === '8' && idx === romansTypable.length - 1;
        });
        expect(verseTens?.status, transcript).toBe('correct');
        expect(verseOnes?.status, transcript).toBe('wrong');
        expect(summary.wrongCount, transcript).toBeGreaterThan(0);
        expect(summary.correctCount, transcript).toBeLessThan(romansTypable.length);
      }
    });

    it('accepts correct Romans 8:28 reference digits', () => {
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'And we know that all things work together for good Romans 8:28',
        'Romans 8:28'
      );
      expect(summary.correctCount).toBe(romansTypable.length);
      expect(summary.wrongCount).toBe(0);
    });

    it('aligns Romans 8:28 when STT speaks twenty eight', () => {
      for (const transcript of [
        'And we know that all things work together for good Romans 8 twenty eight',
        'And we know that all things work together for good Romans 8 twenty-eight',
        'And we know that all things work together for good Romans chapter 8 verse twenty eight',
        'Romans 8 verse twenty eight and we know that all things work together for good',
      ]) {
        const summary = alignRecitation(romansTokens, romansTypable, transcript, 'Romans 8:28');
        expect(summary.correctCount, transcript).toBe(romansTypable.length);
        expect(summary.wrongCount, transcript).toBe(0);
        expect(summary.missingCount, transcript).toBe(0);
      }
    });

    it('aligns reference spoken before the verse', () => {
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'Romans chapter 8 verse 28 and we know that all things work together for good',
        'Romans 8:28'
      );
      expect(summary.correctCount).toBe(romansTypable.length);
      expect(summary.missingCount).toBe(0);
      expect(summary.wrongCount).toBe(0);
    });

    it('aligns reference spoken first for John 3:16', () => {
      const summary = alignRecitation(
        tokens,
        typable,
        'John 3 16 for God so loved the world',
        'John 3:16'
      );
      expect(summary.correctCount).toBe(typable.length);
      expect(summary.missingCount).toBe(0);
    });

    it('aligns numbered book prefixes spoken as ordinals (2 Timothy)', () => {
      const timothyTokens = buildMemorizationTokens(
        'God gave us a spirit not of fear but of power and love.',
        '2 Timothy 1:7'
      );
      const timothyTypable = getTypableTokenIndices(timothyTokens);
      for (const transcript of [
        'God gave us a spirit not of fear but of power and love second Timothy chapter 1 verse 7',
        'second Timothy 1 7 God gave us a spirit not of fear but of power and love',
        'God gave us a spirit not of fear but of power and love 2 Timothy 1 7',
      ]) {
        const summary = alignRecitation(
          timothyTokens,
          timothyTypable,
          transcript,
          '2 Timothy 1:7'
        );
        expect(summary.correctCount, transcript).toBe(timothyTypable.length);
        expect(summary.wrongCount, transcript).toBe(0);
        expect(summary.missingCount, transcript).toBe(0);
      }

      const bookDigit = alignRecitation(
        timothyTokens,
        timothyTypable,
        'God gave us a spirit not of fear but of power and love first Timothy 1 7',
        '2 Timothy 1:7'
      ).results.find((r) => timothyTokens[r.tokenIndex]?.text === '2');
      expect(bookDigit?.status).toBe('wrong');
    });

    it('does not treat verse word first as book digit one', () => {
      const tokensWithFirst = buildMemorizationTokens(
        'First of all you must understand this',
        '2 Peter 1:20'
      );
      const typableWithFirst = getTypableTokenIndices(tokensWithFirst);
      const summary = alignRecitation(
        tokensWithFirst,
        typableWithFirst,
        'First of all you must understand this second Peter 1 20',
        '2 Peter 1:20'
      );
      const firstWord = summary.results.find(
        (r) => tokensWithFirst[r.tokenIndex]?.text === 'First'
      );
      const bookDigit = summary.results.find(
        (r) => tokensWithFirst[r.tokenIndex]?.text === '2'
      );
      expect(firstWord?.status).toBe('correct');
      expect(bookDigit?.status).toBe('correct');
      expect(bookDigit?.spokenText).toBe('second');
    });

    it('does not mark all following words wrong after one missed word', () => {
      const summary = alignRecitation(
        tokens,
        typable,
        'For so loved the world',
        'John 3:16'
      );
      const god = summary.results.find((r) => tokens[r.tokenIndex]?.text === 'God');
      const world = summary.results.find((r) => tokens[r.tokenIndex]?.text === 'world');
      expect(god?.status).toBe('missing');
      expect(world?.status).toBe('correct');
      expect(summary.correctCount).toBeGreaterThan(4);
    });

    it('does not cascade failures after a wrong spoken word', () => {
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'Romans 8:28 and we know that all things work together for good',
        'Romans 8:28'
      );
      const know = summary.results.find((r) => romansTokens[r.tokenIndex]?.text === 'know');
      const good = summary.results.find((r) => romansTokens[r.tokenIndex]?.text === 'good');
      expect(know?.status).toBe('correct');
      expect(good?.status).toBe('correct');
    });

    it('builds aligned columns with expected words below spoken matches', () => {
      const summary = alignRecitation(
        tokens,
        typable,
        'For so loved the world',
        'John 3:16'
      );
      const godCol = summary.alignedColumns.find((c) => c.expected?.text === 'God');
      expect(godCol?.spokenChars).toEqual([{ char: '—', status: 'missing' }]);
      expect(godCol?.expected?.status).toBe('missing');

      const forCol = summary.alignedColumns.find((c) => c.expected?.text === 'For');
      expect(forCol?.spoken?.text).toBe('for');
      expect(forCol?.spoken?.status).toBe('correct');
      expect(forCol?.expected?.status).toBe('correct');
    });

    it('shows multi-digit reference numbers as one unit in aligned columns', () => {
      const romansTokens = buildMemorizationTokens(
        'And we know that all things work together for good',
        'Romans 8:28'
      );
      const romansTypable = getTypableTokenIndices(romansTokens);
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'And we know that all things work together for good Romans 8 28',
        'Romans 8:28'
      );
      expect(summary.alignedColumns.some((c) => c.expected?.text === '28')).toBe(true);
      expect(
        summary.alignedColumns.filter((c) => c.expected?.text === '2' || c.expected?.text === '8')
          .length
      ).toBe(1);
    });

    it('shows per-digit skipped markers in grouped verse numbers', () => {
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'And we know that all things work together for good Romans 8 8',
        'Romans 8:28'
      );
      const verse28 = summary.alignedColumns.find((c) => c.expected?.text === '28');
      expect(verse28?.spokenChars).toEqual([
        { char: '8', status: 'wrong' },
        { char: '—', status: 'missing' },
      ]);
    });

    it('lists every spoken word in transcript order for results display', () => {
      const summary = alignRecitation(
        tokens,
        typable,
        'For so loved the world',
        'John 3:16'
      );
      expect(summary.spokenWords.map((w) => w.text)).toEqual(['for', 'so', 'loved', 'the', 'world']);
      expect(summary.missingCount).toBeGreaterThan(0);
    });

    it('builds spoken transcript display from what was said', () => {
      const summary = alignRecitation(
        tokens,
        typable,
        'For God so loved the world John 3 1 9',
        'John 3:16'
      );
      expect(summary.spokenWords.some((w) => w.text === '9' && w.status === 'wrong')).toBe(true);
      expect(summary.spokenWords.some((w) => w.text === 'god' && w.status === 'correct')).toBe(true);
      expect(summary.spokenWords.some((w) => w.text === 'God')).toBe(false);
    });

    it('marks only the first word wrong when verse starts with a duplicate later word', () => {
      const romansFullTokens = buildMemorizationTokens(
        'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
        'Romans 8:28'
      );
      const romansFullTypable = getTypableTokenIndices(romansFullTokens);
      const summary = alignRecitation(
        romansFullTokens,
        romansFullTypable,
        'for we know that for those who love god all things work together for good for those who are called according to his purpose romans 8 28',
        'Romans 8:28'
      );
      const and = summary.results.find((r) => romansFullTokens[r.tokenIndex]?.text === 'And');
      const we = summary.results.find((r) => romansFullTokens[r.tokenIndex]?.text === 'we');
      const know = summary.results.find((r) => romansFullTokens[r.tokenIndex]?.text === 'know');
      const that = summary.results.find((r) => romansFullTokens[r.tokenIndex]?.text === 'that');
      const secondFor = summary.results.filter(
        (r) => romansFullTokens[r.tokenIndex]?.text === 'for'
      );
      expect(and?.status).toBe('wrong');
      expect(and?.spokenText).toBe('for');
      expect(we?.status).toBe('correct');
      expect(know?.status).toBe('correct');
      expect(that?.status).toBe('correct');
      expect(secondFor.some((r) => r.status === 'correct')).toBe(true);
      expect(summary.missingCount).toBe(0);
      expect(summary.wrongCount).toBe(1);
    });

    it('marks only the first word wrong on the short Romans sample verse', () => {
      const summary = alignRecitation(
        romansTokens,
        romansTypable,
        'for we know that all things work together for good Romans 8 28',
        'Romans 8:28'
      );
      const and = summary.results.find((r) => romansTokens[r.tokenIndex]?.text === 'And');
      const we = summary.results.find((r) => romansTokens[r.tokenIndex]?.text === 'we');
      expect(and?.status).toBe('wrong');
      expect(and?.spokenText).toBe('for');
      expect(we?.status).toBe('correct');
      expect(summary.missingCount).toBe(0);
    });

    it('aligns purpose wrong and Romans correct when timing is said once before Romans', () => {
      const romansFullTokens = buildMemorizationTokens(
        'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
        'Romans 8:28'
      );
      const romansFullTypable = getTypableTokenIndices(romansFullTokens);
      const summary = alignRecitation(
        romansFullTokens,
        romansFullTypable,
        'for we know that for those who love god all things work for good for those who are called according to his timing romans 8 28',
        'Romans 8:28'
      );
      const purpose = summary.results.find((r) =>
        normalizeReciteWord(romansFullTokens[r.tokenIndex]?.text ?? '').includes('purpose')
      );
      const romans = summary.results.find(
        (r) => romansFullTokens[r.tokenIndex]?.text === 'Romans'
      );
      const together = summary.results.find(
        (r) => romansFullTokens[r.tokenIndex]?.text === 'together'
      );
      expect(purpose?.status).toBe('wrong');
      expect(purpose?.spokenText).toBe('timing');
      expect(romans?.status).toBe('correct');
      expect(romans?.spokenText).toBe('romans');
      expect(together?.status).toBe('missing');
      expect(
        summary.results.filter((r) => r.spokenText === 'timing' && r.status === 'wrong')
      ).toHaveLength(1);
    });
  });
});
