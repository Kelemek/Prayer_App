import type { MemorizationToken } from './memorizationPracticeUtils';
import { parseReferenceMemorizationTokens } from './memorizationPracticeUtils';

export type ReciteTokenStatus = 'correct' | 'missing' | 'wrong';

export type ReciteAlignmentResult = {
  tokenIndex: number;
  status: ReciteTokenStatus;
  spokenText?: string;
  /** Index in tokenized transcript when this result consumed a spoken word. */
  spokenIndex?: number;
};

export type ReciteSpokenWordDisplay = {
  text: string;
  status: 'correct' | 'wrong';
};

export type ReciteAlignedSpokenChar = {
  char: string;
  status: 'correct' | 'wrong' | 'missing';
};

export type ReciteAlignedColumnDisplay = {
  spoken?: { text: string; status: 'correct' | 'wrong' };
  /** Per-character top row for grouped digits or skipped words. */
  spokenChars?: ReciteAlignedSpokenChar[];
  expected?: { text: string; status: ReciteTokenStatus };
};

/** Grouped verse/reference units for recite practice display (multi-digit refs stay together). */
export type ReciteDisplaySegment = {
  kind: 'punct' | 'word' | 'digits';
  text: string;
  tokenIndices: number[];
};

export type ReciteAlignmentSummary = {
  results: ReciteAlignmentResult[];
  spokenWords: ReciteSpokenWordDisplay[];
  alignedColumns: ReciteAlignedColumnDisplay[];
  correctCount: number;
  wrongCount: number;
  missingCount: number;
  totalTypable: number;
};

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
  hundred: '100',
};

const COMPOUND_NUMBER_WORDS: Record<string, string> = buildCompoundNumberWords();

/** Book-prefix ordinals STT often uses after listen mode speaks "first/second/third …". */
const SPOKEN_ORDINAL_TO_DIGIT: Record<string, string> = {
  first: '1',
  second: '2',
  third: '3',
  '1st': '1',
  '2nd': '2',
  '3rd': '3',
  i: '1',
  ii: '2',
  iii: '3',
};

function spokenOrdinalToDigit(word: string): string | null {
  return SPOKEN_ORDINAL_TO_DIGIT[word] ?? null;
}

function spokenAsDigit(expectedDigit: string, spoken: string): string {
  if (isReciteDigitToken(spoken)) return spoken;
  const fromOrdinal = spokenOrdinalToDigit(spoken);
  if (fromOrdinal === expectedDigit) return fromOrdinal;
  return spoken;
}

function buildCompoundNumberWords(): Record<string, string> {
  const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const ones = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const map: Record<string, string> = {};
  for (let t = 0; t < tens.length; t++) {
    const tensWord = tens[t]!;
    const tensVal = (t + 2) * 10;
    for (let o = 0; o < ones.length; o++) {
      map[`${tensWord}${ones[o]!}`] = String(tensVal + o + 1);
    }
  }
  return map;
}

/** Lowercase alphanumerics for fuzzy word comparison. */
export function normalizeReciteWord(word: string): string {
  let w = word.toLowerCase().replace(/['’]/g, '');
  w = w.replace(/[^\w]/g, '');
  return COMPOUND_NUMBER_WORDS[w] ?? NUMBER_WORDS[w] ?? w;
}

function splitTranscriptPiece(piece: string): string[] {
  if (piece.includes(':')) {
    const parts: string[] = [];
    for (const colonPart of piece.split(':')) {
      for (const sub of colonPart.split('-')) {
        const normalized = normalizeReciteWord(sub);
        if (normalized) parts.push(normalized);
      }
    }
    return parts;
  }
  const parts: string[] = [];
  for (const sub of piece.split('-')) {
    const normalized = normalizeReciteWord(sub);
    if (normalized) parts.push(normalized);
  }
  return parts;
}

/** Merge STT number phrases (twenty eight → 28, to eight → 28). */
function combineSpokenNumberPhrases(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (/^(20|30|40|50|60|70|80|90)$/.test(word) && i + 1 < words.length) {
      const next = words[i + 1]!;
      if (/^[1-9]$/.test(next)) {
        out.push(String(Number(word) + Number(next)));
        i += 1;
        continue;
      }
    }
    if ((word === 'to' || word === 'too') && i + 1 < words.length) {
      const next = words[i + 1]!;
      if (/^[1-9]$/.test(next)) {
        out.push(`2${next}`);
        i += 1;
        continue;
      }
    }
    out.push(word);
  }
  return out;
}

export function tokenizeReciteTranscript(transcript: string): string[] {
  const words: string[] = [];
  for (const piece of transcript.trim().split(/\s+/).filter(Boolean)) {
    words.push(...splitTranscriptPiece(piece));
  }
  return combineSpokenNumberPhrases(words);
}

function isReciteDigitToken(token: string): boolean {
  return /^\d+$/.test(token);
}

function isSingleDigitToken(token: string): boolean {
  return /^\d$/.test(token);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, row[j]! + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length]!;
}

function tokensOnlyPunctuationBetween(
  tokens: MemorizationToken[],
  startTokenIndex: number,
  endTokenIndex: number
): boolean {
  for (let i = startTokenIndex + 1; i < endTokenIndex; i++) {
    const token = tokens[i]!;
    if (token.kind === 'punct') {
      if (token.text === ':' || token.text === '-') return false;
      continue;
    }
    return false;
  }
  return true;
}

/** Walk tokens for recite UI: merge verse digits (e.g. 28) but not across : or -. */
export function buildReciteDisplaySegments(tokens: MemorizationToken[]): ReciteDisplaySegment[] {
  const segments: ReciteDisplaySegment[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.kind === 'punct') {
      segments.push({ kind: 'punct', text: token.text, tokenIndices: [] });
      i += 1;
      continue;
    }
    if (token.kind === 'word') {
      segments.push({ kind: 'word', text: token.text, tokenIndices: [i] });
      i += 1;
      continue;
    }

    const tokenIndices = [i];
    let text = token.text;
    let j = i + 1;
    while (j < tokens.length) {
      const next = tokens[j]!;
      if (next.kind !== 'digit') break;
      if (!tokensOnlyPunctuationBetween(tokens, tokenIndices[tokenIndices.length - 1]!, j)) {
        break;
      }
      tokenIndices.push(j);
      text += next.text;
      j += 1;
    }
    segments.push({ kind: 'digits', text, tokenIndices });
    i = j;
  }
  return segments;
}

function consumeExpectedDigit(
  expectedDigit: string,
  candidate: string
): { status: 'correct' | 'wrong'; fragment: string; remainder: string | null } {
  const first = candidate[0]!;
  const remainder = candidate.length > 1 ? candidate.slice(1) : null;
  if (first === expectedDigit) {
    return { status: 'correct', fragment: first, remainder };
  }
  if (candidate.length === 1) {
    return { status: 'wrong', fragment: candidate, remainder: null };
  }
  return { status: 'wrong', fragment: candidate, remainder: null };
}

function wordsFuzzyMatch(expected: string, spoken: string): boolean {
  if (expected === spoken) return true;
  // Single reference digits (8 vs 9, 8 vs 6) are one edit apart and must not fuzzy-match.
  if (isReciteDigitToken(expected) || isReciteDigitToken(spoken)) {
    return false;
  }
  const maxLen = Math.max(expected.length, spoken.length);
  if (maxLen === 0) return true;
  const threshold = maxLen <= 4 ? 1 : maxLen <= 8 ? 2 : 3;
  return levenshtein(expected, spoken) <= threshold;
}

/** Filler words STT often inserts around scripture references. */
const SKIP_SPOKEN_WORDS = new Set(['chapter', 'ch', 'verse', 'verses']);

export function splitTypableVerseAndReference(
  typableIndices: number[],
  reference: string
): { verseTypable: number[]; refTypable: number[] } {
  const refTypableCount = parseReferenceMemorizationTokens(reference).filter(
    (t) => t.kind === 'word' || t.kind === 'digit'
  ).length;
  if (refTypableCount <= 0 || refTypableCount >= typableIndices.length) {
    return { verseTypable: typableIndices, refTypable: [] };
  }
  return {
    verseTypable: typableIndices.slice(0, -refTypableCount),
    refTypable: typableIndices.slice(-refTypableCount),
  };
}

function isSkippableSpokenWord(word: string): boolean {
  return SKIP_SPOKEN_WORDS.has(word);
}

function tokenMatchStatus(expected: string, spoken: string): ReciteTokenStatus | null {
  if (expected === spoken) return 'correct';
  if (isReciteDigitToken(expected)) {
    const spokenDigit = spokenAsDigit(expected, spoken);
    if (isReciteDigitToken(spokenDigit)) {
      return spokenDigit === expected ? 'correct' : 'wrong';
    }
    return null;
  }
  return wordsFuzzyMatch(expected, spoken) ? 'correct' : null;
}

/**
 * True when the spoken word matches an upcoming expected token because the user
 * skipped ahead (missing current). Repeated words in the verse must not match
 * far-ahead duplicates (e.g. saying "for" instead of "And" must not align to
 * the later "for" in "for those who love").
 */
function countTypableWord(
  tokens: MemorizationToken[],
  typableIndices: number[],
  normalizedWord: string
): number {
  let count = 0;
  for (const tokenIndex of typableIndices) {
    if (normalizeReciteWord(tokens[tokenIndex]!.text) === normalizedWord) {
      count += 1;
    }
  }
  return count;
}

function matchesUpcomingMissing(
  tokens: MemorizationToken[],
  typableIndices: number[],
  currentSlot: number,
  spokenWord: string,
  maxLookahead = 4
): boolean {
  for (let offset = 1; offset <= maxLookahead; offset++) {
    const idx = currentSlot + offset;
    if (idx >= typableIndices.length) break;
    const expected = normalizeReciteWord(tokens[typableIndices[idx]!]!.text);
    if (tokenMatchStatus(expected, spokenWord) !== 'correct') {
      continue;
    }

    if (offset === 1) {
      return true;
    }

    if (countTypableWord(tokens, typableIndices, spokenWord) > 1) {
      return false;
    }

    return true;
  }
  return false;
}

function matchesAnyExpectedToken(
  tokens: MemorizationToken[],
  typableIndices: number[],
  spokenWord: string
): boolean {
  for (const tokenIndex of typableIndices) {
    const expected = normalizeReciteWord(tokens[tokenIndex]!.text);
    if (tokenMatchStatus(expected, spokenWord) === 'correct') {
      return true;
    }
  }
  return false;
}

type AlignTypableSubsequenceResult = {
  results: ReciteAlignmentResult[];
  spokenAssignments: Array<{ spokenIndex: number; text: string; status: 'correct' | 'wrong' }>;
  finalSpokenIdx: number;
};

function alignTypableSubsequence(
  tokens: MemorizationToken[],
  typableIndices: number[],
  spoken: string[],
  crossSectionTypableIndices: number[] = [],
  startSpokenIdx = 0,
  isFinalSection = true
): AlignTypableSubsequenceResult {
  const results: ReciteAlignmentResult[] = [];
  const spokenAssignments: AlignTypableSubsequenceResult['spokenAssignments'] = [];
  let spokenIdx = startSpokenIdx;
  let digitRemainder: string | null = null;

  const advanceSpokenIndex = (): void => {
    digitRemainder = null;
    spokenIdx += 1;
  };

  const currentCandidate = (): string | null => {
    if (digitRemainder !== null) return digitRemainder;
    if (spokenIdx >= spoken.length) return null;
    const word = spoken[spokenIdx]!;
    if (isSkippableSpokenWord(word)) return null;
    return word;
  };

  for (let slot = 0; slot < typableIndices.length; slot++) {
    const tokenIndex = typableIndices[slot]!;
    const expectedWord = normalizeReciteWord(tokens[tokenIndex]!.text);
    let matched = false;

    while (spokenIdx < spoken.length || digitRemainder !== null) {
      if (digitRemainder === null) {
        while (spokenIdx < spoken.length && isSkippableSpokenWord(spoken[spokenIdx]!)) {
          spokenIdx += 1;
        }
      }

      const candidate = currentCandidate();
      if (!candidate) break;

      if (isSingleDigitToken(expectedWord)) {
        const ordinalDigit = spokenOrdinalToDigit(candidate);
        if (ordinalDigit !== null && ordinalDigit !== expectedWord) {
          results.push({
            tokenIndex,
            status: 'wrong',
            spokenText: candidate,
            spokenIndex: spokenIdx,
          });
          spokenAssignments.push({
            spokenIndex: spokenIdx,
            text: candidate,
            status: 'wrong',
          });
          advanceSpokenIndex();
          matched = true;
          break;
        }

        const digitCandidate = spokenAsDigit(expectedWord, candidate);
        if (!isReciteDigitToken(digitCandidate)) {
          break;
        }
        const digitMatch = consumeExpectedDigit(expectedWord, digitCandidate);
        const assignmentStatus = digitMatch.status;
        const spokenDisplay =
          candidate !== digitCandidate ? candidate : digitMatch.fragment;
        results.push({
          tokenIndex,
          status: digitMatch.status,
          spokenText: spokenDisplay,
          spokenIndex: spokenIdx,
        });
        spokenAssignments.push({
          spokenIndex: spokenIdx,
          text: spokenDisplay,
          status: assignmentStatus,
        });
        if (digitMatch.remainder) {
          digitRemainder = digitMatch.remainder;
        } else {
          advanceSpokenIndex();
        }
        matched = true;
        break;
      }

      if (isReciteDigitToken(candidate)) {
        spokenIdx += 1;
        digitRemainder = null;
        continue;
      }

      const status = tokenMatchStatus(expectedWord, candidate);
      if (status === 'correct' || status === 'wrong') {
        results.push({ tokenIndex, status, spokenText: candidate, spokenIndex: spokenIdx });
        spokenAssignments.push({ spokenIndex: spokenIdx, text: candidate, status });
        advanceSpokenIndex();
        matched = true;
        break;
      }

      if (matchesUpcomingMissing(tokens, typableIndices, slot, candidate)) {
        results.push({ tokenIndex, status: 'missing' });
        matched = true;
        break;
      }

      if (
        crossSectionTypableIndices.length > 0 &&
        matchesAnyExpectedToken(tokens, crossSectionTypableIndices, candidate)
      ) {
        advanceSpokenIndex();
        continue;
      }

      results.push({ tokenIndex, status: 'wrong', spokenText: candidate, spokenIndex: spokenIdx });
      spokenAssignments.push({ spokenIndex: spokenIdx, text: candidate, status: 'wrong' });
      advanceSpokenIndex();
      matched = true;
      break;
    }

    if (!matched) {
      results.push({ tokenIndex, status: 'missing' });
    }
  }

  if (isFinalSection) {
    while (spokenIdx < spoken.length) {
      const candidate = spoken[spokenIdx]!;
      if (!isSkippableSpokenWord(candidate)) {
        spokenAssignments.push({ spokenIndex: spokenIdx, text: candidate, status: 'wrong' });
      }
      spokenIdx += 1;
    }
  }

  return { results, spokenAssignments, finalSpokenIdx: spokenIdx };
}

function detectSpokenRefFirst(
  tokens: MemorizationToken[],
  verseTypable: number[],
  refTypable: number[],
  spoken: string[]
): boolean {
  if (verseTypable.length === 0 || refTypable.length === 0) {
    return false;
  }

  const firstVerse = normalizeReciteWord(tokens[verseTypable[0]!]!.text);
  const firstRef = normalizeReciteWord(tokens[refTypable[0]!]!.text);
  let verseIdx = -1;
  let refIdx = -1;

  for (let i = 0; i < spoken.length; i++) {
    const word = spoken[i]!;
    if (verseIdx < 0 && tokenMatchStatus(firstVerse, word) === 'correct') {
      verseIdx = i;
    }
    if (refIdx < 0 && tokenMatchStatus(firstRef, word) === 'correct') {
      refIdx = i;
    }
    if (verseIdx >= 0 && refIdx >= 0) {
      break;
    }
  }

  return refIdx >= 0 && verseIdx >= 0 && refIdx < verseIdx;
}

function mergeDigitResultStatuses(statuses: ReciteTokenStatus[]): ReciteTokenStatus {
  if (statuses.some((s) => s === 'missing')) return 'missing';
  if (statuses.some((s) => s === 'wrong')) return 'wrong';
  return 'correct';
}

function spokenCharForResult(
  tokens: MemorizationToken[],
  result: ReciteAlignmentResult
): ReciteAlignedSpokenChar {
  if (result.status === 'missing') {
    return { char: '—', status: 'missing' };
  }
  return {
    char: result.spokenText ?? tokens[result.tokenIndex]!.text,
    status: result.status === 'correct' ? 'correct' : 'wrong',
  };
}

function buildAlignedColumns(
  tokens: MemorizationToken[],
  results: ReciteAlignmentResult[],
  assignments: AlignTypableSubsequenceResult['spokenAssignments']
): ReciteAlignedColumnDisplay[] {
  const sorted = results.slice().sort((a, b) => a.tokenIndex - b.tokenIndex);
  const columns: ReciteAlignedColumnDisplay[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const result = sorted[i]!;
    const token = tokens[result.tokenIndex]!;
    if (token.kind !== 'digit') {
      const spokenChars =
        result.status === 'missing' || result.spokenText
          ? [spokenCharForResult(tokens, result)]
          : undefined;
      columns.push({
        spoken: result.spokenText
          ? {
              text: result.spokenText,
              status: result.status === 'correct' ? 'correct' : 'wrong',
            }
          : undefined,
        spokenChars,
        expected: {
          text: token.text,
          status: result.status,
        },
      });
      continue;
    }

    let j = i;
    const group: ReciteAlignmentResult[] = [];
    while (j < sorted.length) {
      const groupResult = sorted[j]!;
      const groupToken = tokens[groupResult.tokenIndex]!;
      if (groupToken.kind !== 'digit') break;
      if (
        group.length > 0 &&
        !tokensOnlyPunctuationBetween(
          tokens,
          group[group.length - 1]!.tokenIndex,
          groupResult.tokenIndex
        )
      ) {
        break;
      }
      group.push(groupResult);
      j++;
    }

    const expectedText = group.map((r) => tokens[r.tokenIndex]!.text).join('');
    const spokenChars = group.map((r) => spokenCharForResult(tokens, r));
    const expectedStatus = mergeDigitResultStatuses(group.map((r) => r.status));
    columns.push({
      spokenChars,
      expected: {
        text: expectedText,
        status: expectedStatus,
      },
    });
    i = j - 1;
  }

  const linkedSpokenIndices = new Set(
    results.map((r) => r.spokenIndex).filter((idx): idx is number => idx !== undefined)
  );
  for (const assignment of [...assignments].sort((a, b) => a.spokenIndex - b.spokenIndex)) {
    if (linkedSpokenIndices.has(assignment.spokenIndex)) continue;
    columns.push({
      spoken: { text: assignment.text, status: assignment.status },
    });
  }

  return columns;
}

function buildSpokenWordsFromTranscript(
  spoken: string[],
  assignments: AlignTypableSubsequenceResult['spokenAssignments']
): ReciteSpokenWordDisplay[] {
  const statusByIndex = new Map<number, 'correct' | 'wrong'>();
  for (const assignment of assignments) {
    const existing = statusByIndex.get(assignment.spokenIndex);
    if (!existing || assignment.status === 'wrong') {
      statusByIndex.set(assignment.spokenIndex, assignment.status);
    }
  }

  const spokenWords: ReciteSpokenWordDisplay[] = [];
  for (let i = 0; i < spoken.length; i++) {
    const text = spoken[i]!;
    if (isSkippableSpokenWord(text)) continue;
    spokenWords.push({
      text,
      status: statusByIndex.get(i) ?? 'wrong',
    });
  }
  return spokenWords;
}

/**
 * Word-level alignment of spoken transcript to expected typable tokens.
 * Reference may be spoken before or after the verse body.
 */
export function alignRecitation(
  tokens: MemorizationToken[],
  typableIndices: number[],
  transcript: string,
  reference = ''
): ReciteAlignmentSummary {
  const spoken = tokenizeReciteTranscript(transcript);
  const { verseTypable, refTypable } = splitTypableVerseAndReference(
    typableIndices,
    reference
  );

  const refFirst = detectSpokenRefFirst(tokens, verseTypable, refTypable, spoken);
  let verseAligned: AlignTypableSubsequenceResult;
  let refAligned: AlignTypableSubsequenceResult;
  if (refFirst) {
    refAligned = alignTypableSubsequence(tokens, refTypable, spoken, verseTypable, 0, false);
    verseAligned = alignTypableSubsequence(
      tokens,
      verseTypable,
      spoken,
      [],
      refAligned.finalSpokenIdx,
      true
    );
  } else {
    verseAligned = alignTypableSubsequence(tokens, verseTypable, spoken, [], 0, false);
    refAligned = alignTypableSubsequence(
      tokens,
      refTypable,
      spoken,
      [],
      verseAligned.finalSpokenIdx,
      true
    );
  }
  const results = [...verseAligned.results, ...refAligned.results].sort(
    (a, b) => a.tokenIndex - b.tokenIndex
  );
  const allAssignments = [
    ...verseAligned.spokenAssignments,
    ...refAligned.spokenAssignments,
  ];
  const spokenWords = buildSpokenWordsFromTranscript(spoken, allAssignments);
  const alignedColumns = buildAlignedColumns(tokens, results, allAssignments);

  let correctCount = 0;
  let wrongCount = 0;
  let missingCount = 0;
  for (const r of results) {
    if (r.status === 'correct') correctCount++;
    else if (r.status === 'wrong') wrongCount++;
    else missingCount++;
  }

  return {
    results,
    spokenWords,
    alignedColumns,
    correctCount,
    wrongCount,
    missingCount,
    totalTypable: typableIndices.length,
  };
}

export function reciteScorePercent(summary: ReciteAlignmentSummary): number {
  if (summary.totalTypable === 0) return 100;
  return Math.round((summary.correctCount / summary.totalTypable) * 100);
}
