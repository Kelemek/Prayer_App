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

export const API_BIBLE_TRANSLATION_CODES = [
  'kjv',
  'nasb',
  'lsb',
  'niv',
  'nlt',
  'csb',
] as const;

export type ApiBibleTranslation = (typeof API_BIBLE_TRANSLATION_CODES)[number];

export function isBibleTranslation(value: string | null | undefined): value is BibleTranslation {
  return !!value && (BIBLE_TRANSLATION_CODES as readonly string[]).includes(value);
}

export function isApiBibleTranslation(
  value: string | null | undefined
): value is ApiBibleTranslation {
  return !!value && (API_BIBLE_TRANSLATION_CODES as readonly string[]).includes(value);
}
