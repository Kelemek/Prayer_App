export const BIBLE_TRANSLATION_CODES = [
  'esv',
  'kjv',
  'nasb',
  'lsb',
  'niv',
  'nlt',
  'csb',
] as const;

export type BibleTranslation = (typeof BIBLE_TRANSLATION_CODES)[number];

export function isBibleTranslation(
  value: string | null | undefined
): value is BibleTranslation {
  return !!value && (BIBLE_TRANSLATION_CODES as readonly string[]).includes(value);
}

/** Only ESV has passage-level streaming audio suitable for memorize listen. */
export function isMemorizationListenTranslation(translation: BibleTranslation): boolean {
  return translation === 'esv';
}

export type MemorizationMasterLevel = 'learning' | 'practicing' | 'mastered';

export interface MemorizationPracticeSessionRecord {
  date: number;
  wrongAttempts: number;
  correctKeystrokes: number;
  completed: boolean;
}

export type MemorizationInProgressPhase =
  | { kind: 'betweenRounds'; completedRoundIndex: number }
  | { kind: 'inRound'; roundIndex: number };

export type MemorizationPracticeMode =
  | 'type'
  | 'word'
  | 'reorder'
  | 'firstLetters';

export interface MemorizationInProgress {
  sessionSeed: string;
  wrongAttempts: number;
  correctKeystrokes: number;
  updatedAt: number;
  phase: MemorizationInProgressPhase;
  practiceMode?: MemorizationPracticeMode;
}

export type MemorizationInProgressSavePayload = Omit<
  MemorizationInProgress,
  'updatedAt'
>;

export type MemorizationItemKind = 'verse' | 'bibleBooks';

export type BibleBooksMemorizationScope = 'all' | 'ot' | 'nt';

export interface MemorizedItem {
  id: string;
  reference: string;
  text: string;
  translation: BibleTranslation;
  dateAdded: number;
  lastPracticedAt: number | null;
  practiceSessions: MemorizationPracticeSessionRecord[];
  inProgressPractice?: MemorizationInProgress | null;
  kind?: MemorizationItemKind;
  bibleBooksScope?: BibleBooksMemorizationScope;
}

export interface MemorizedItemRow {
  id: string;
  user_email: string;
  tenant_id: string;
  reference: string;
  text: string;
  translation: string;
  kind: MemorizationItemKind;
  bible_books_scope: BibleBooksMemorizationScope | null;
  date_added: string;
  last_practiced_at: string | null;
  practice_sessions: MemorizationPracticeSessionRecord[];
  in_progress_practice: MemorizationInProgress | null;
  created_at: string;
  updated_at: string;
}

export const BIBLE_TRANSLATION_LABELS: Record<BibleTranslation, string> = {
  esv: 'ESV',
  kjv: 'KJV',
  nasb: 'NASB',
  lsb: 'LSB',
  niv: 'NIV',
  nlt: 'NLT',
  csb: 'CSB',
};
