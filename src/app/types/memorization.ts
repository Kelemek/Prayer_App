export const BIBLE_TRANSLATION_CODES = [
  'esv',
  'nasb',
  'lsb',
  'csb',
  'kjv',
  'niv',
  'nlt',
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

export const BIBLE_TRANSLATION_LABELS: Record<BibleTranslation, string> = {
  esv: 'ESV — English Standard Version',
  kjv: 'KJV — King James Version',
  nasb: 'NASB — New American Standard Bible',
  lsb: 'LSB — Legacy Standard Bible',
  niv: 'NIV — New International Version',
  nlt: 'NLT — New Living Translation',
  csb: 'CSB — Christian Standard Bible',
};

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
  | 'firstLetters'
  | 'recite';

export type MemorizationReciteSttProvider = 'browser' | 'whisper';

export const MEMORIZATION_RECITE_WHISPER_MODELS = [
  'whisper-1',
  'gpt-4o-mini-transcribe',
] as const;

export type MemorizationReciteWhisperModel = (typeof MEMORIZATION_RECITE_WHISPER_MODELS)[number];

export const MEMORIZATION_RECITE_WHISPER_MODEL_RATES_USD_PER_MINUTE: Record<
  MemorizationReciteWhisperModel,
  number
> = {
  'whisper-1': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
};

export const MEMORIZATION_RECITE_WHISPER_MODEL_LABELS: Record<
  MemorizationReciteWhisperModel,
  string
> = {
  'whisper-1': 'Whisper (higher accuracy)',
  'gpt-4o-mini-transcribe': 'GPT-4o mini transcribe (lower cost)',
};

export function isMemorizationReciteSttProvider(
  value: string | null | undefined
): value is MemorizationReciteSttProvider {
  return value === 'browser' || value === 'whisper';
}

export function isMemorizationReciteWhisperModel(
  value: string | null | undefined
): value is MemorizationReciteWhisperModel {
  return (
    !!value &&
    (MEMORIZATION_RECITE_WHISPER_MODELS as readonly string[]).includes(value)
  );
}

export interface MemorizationReciteSettings {
  enabled: boolean;
  sttProvider: MemorizationReciteSttProvider;
  whisperModel: MemorizationReciteWhisperModel;
}

export interface MemorizationReciteUsageSummary {
  attemptCount: number;
  whisperAttemptCount: number;
  browserAttemptCount: number;
  totalAudioSeconds: number;
  billableAudioSeconds: number;
  estimatedCostUsd: number;
}

export interface MemorizationInProgress {
  sessionSeed: string;
  wrongAttempts: number;
  correctKeystrokes: number;
  updatedAt: number;
  phase: MemorizationInProgressPhase;
  practiceMode?: MemorizationPracticeMode;
  /** Per-round wrong attempts for strict mode resume (optional on legacy saves). */
  wrongAttemptsInRound?: number;
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

export type MemorizationCatalogSource = 'ibcd' | null;

/** Admin-curated category for Memorize recommendation verses (tenant-scoped). */
export interface MemorizationRecommendationCategory {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  catalogSource: MemorizationCatalogSource;
  createdAt: string;
  updatedAt: string;
}

export interface MemorizationRecommendationCategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  catalog_source?: MemorizationCatalogSource;
  created_at: string;
  updated_at: string;
}

/** Admin-curated verse shown on the Memorize tab as a recommendation (translation-agnostic). */
export interface MemorizationRecommendation {
  id: string;
  tenantId: string;
  reference: string;
  categoryId: string;
  displayOrder: number;
  catalogSource: MemorizationCatalogSource;
  createdAt: string;
  updatedAt: string;
}

export interface MemorizationRecommendationRow {
  id: string;
  tenant_id: string;
  reference: string;
  category_id: string;
  display_order: number;
  catalog_source?: MemorizationCatalogSource;
  created_at: string;
  updated_at: string;
}

/** User adds a recommended verse with their chosen translation. */
export interface MemorizationRecommendationAddPayload {
  recommendation: MemorizationRecommendation;
  translation: BibleTranslation;
}

/** Category with its verses, ordered for the Recommended modal / admin UI. */
export interface MemorizationRecommendationCategoryGroup {
  category: MemorizationRecommendationCategory;
  items: MemorizationRecommendation[];
}

/** IBCD catalog apply status for a tenant (from get_memorization_ibcd_catalog_status RPC). */
export interface IbcdCatalogStatus {
  applied: boolean;
  ibcdCategoryCount: number;
  ibcdVerseCount: number;
}
