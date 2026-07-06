// @ts-nocheck - Deno Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ----- bible-translations.ts -----
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



// ----- parse-scripture-reference.ts -----
/** Verse count for Protestant one-chapter books (Obadiah, Philemon, 2–3 John, Jude). */
const SINGLE_CHAPTER_BOOK_VERSES = new Map<string, number>([
  ['obadiah', 21],
  ['philemon', 25],
  ['2 john', 13],
  ['3 john', 15],
  ['jude', 25],
]);

/**
 * Parse a scripture reference into components (shared by ESV and API.Bible paths).
 */
export function parseReference(
  reference: string
): { book: string; chapter: number; verseStart: number | null; verseEnd: number | null } | null {
  const normalized = reference.replace(/–/g, '-').replace(/(\d+)[a-z]+/g, '$1');

  const match = normalized.match(/^(.+?)\s+(\d+)(?::\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!match) return null;

  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verseStart: match[3] ? parseInt(match[3], 10) : null,
    verseEnd: match[4] ? parseInt(match[4], 10) : null,
  };
}

function singleChapterBookVerseCount(book: string): number | null {
  return SINGLE_CHAPTER_BOOK_VERSES.get(book.trim().toLowerCase()) ?? null;
}

function isSingleChapterBookChapterOneReference(reference: string): boolean {
  const parsed = parseReference(reference.trim());
  if (!parsed || parsed.verseStart !== null) return false;
  if (parsed.chapter !== 1) return false;
  return singleChapterBookVerseCount(parsed.book) != null;
}

/**
 * Expand one-chapter book refs like `Obadiah 1` to `Obadiah 1:1-21` for passage providers.
 */
export function scriptureReferenceForPassageQuery(reference: string): string {
  const trimmed = reference.trim();
  if (!isSingleChapterBookChapterOneReference(trimmed)) return trimmed;
  const parsed = parseReference(trimmed);
  if (!parsed) return trimmed;
  const lastVerse = singleChapterBookVerseCount(parsed.book);
  if (lastVerse == null) return trimmed;
  return `${parsed.book} 1:1-${lastVerse}`;
}



// ----- api-bible-passage-id.ts -----

/**
 * Map common English book names/aliases to USFM-style IDs used by API.Bible passage paths.
 * @see https://rest.api.bible — passageId e.g. JHN.3.16 or JHN.3.16-JHN.3.18 or PSA.23
 */
const BOOK_ALIAS_TO_USFM: Record<string, string> = {
  genesis: 'GEN',
  ge: 'GEN',
  ac: 'ACT',
  habak: 'HAB',
  exodus: 'EXO',
  leviticus: 'LEV',
  numbers: 'NUM',
  deuteronomy: 'DEU',
  deut: 'DEU',
  deu: 'DEU',
  dut: 'DEU',
  joshua: 'JOS',
  judges: 'JDG',
  ruth: 'RUT',
  '1 samuel': '1SA',
  '2 samuel': '2SA',
  '1 kings': '1KI',
  '2 kings': '2KI',
  '1 chronicles': '1CH',
  '2 chronicles': '2CH',
  chron: '1CH',
  '1 chron': '1CH',
  '2 chron': '2CH',
  ezra: 'EZR',
  nehemiah: 'NEH',
  esther: 'EST',
  job: 'JOB',
  psalm: 'PSA',
  psalms: 'PSA',
  psa: 'PSA',
  psal: 'PSA',
  proverbs: 'PRO',
  ecclesiastes: 'ECC',
  eccles: 'ECC',
  'song of solomon': 'SNG',
  'song of songs': 'SNG',
  isaiah: 'ISA',
  jeremiah: 'JER',
  lamentations: 'LAM',
  ezekiel: 'EZK',
  daniel: 'DAN',
  hosea: 'HOS',
  joel: 'JOL',
  amos: 'AMO',
  obadiah: 'OBA',
  jonah: 'JON',
  micah: 'MIC',
  nahum: 'NAM',
  habakkuk: 'HAB',
  zephaniah: 'ZEP',
  haggai: 'HAG',
  hag: 'HAG',
  zechariah: 'ZEC',
  malachi: 'MAL',
  matthew: 'MAT',
  mark: 'MRK',
  luke: 'LUK',
  john: 'JHN',
  acts: 'ACT',
  act: 'ACT',
  /** Common abbreviation (e.g. "Rom 8:28") */
  rom: 'ROM',
  '1 cor': '1CO',
  '2 cor': '2CO',
  '1 thess': '1TH',
  '2 thess': '2TH',
  '1 tim': '1TI',
  '2 tim': '2TI',
  '1 pet': '1PE',
  '2 pet': '2PE',
  prov: 'PRO',
  pro: 'PRO',
  matt: 'MAT',
  phil: 'PHP',
  philip: 'PHP',
  'i cor': '1CO',
  'ii cor': '2CO',
  'i pet': '1PE',
  'ii pet': '2PE',
  'i thess': '1TH',
  'ii thess': '2TH',
  'i tim': '1TI',
  'ii tim': '2TI',
  'i sam': '1SA',
  'ii sam': '2SA',
  'i ki': '1KI',
  'ii ki': '2KI',
  'i chr': '1CH',
  'ii chr': '2CH',
  numb: 'NUM',
  num: 'NUM',
  cant: 'SNG',
  canticles: 'SNG',
  song: 'SNG',
  songs: 'SNG',
  exod: 'EXO',
  heb: 'HEB',
  romans: 'ROM',
  '1 corinthians': '1CO',
  '2 corinthians': '2CO',
  galatians: 'GAL',
  ephesians: 'EPH',
  philippians: 'PHP',
  colossians: 'COL',
  colos: 'COL',
  '1 thessalonians': '1TH',
  '2 thessalonians': '2TH',
  '1 timothy': '1TI',
  '2 timothy': '2TI',
  titus: 'TIT',
  philemon: 'PHM',
  hebrews: 'HEB',
  james: 'JAS',
  '1 peter': '1PE',
  '2 peter': '2PE',
  '1 john': '1JN',
  '2 john': '2JN',
  '3 john': '3JN',
  jude: 'JUD',
  revelation: 'REV',
  'revelation of john': 'REV',
  // KJV-style names from DB / users
  'i samuel': '1SA',
  'ii samuel': '2SA',
  'i kings': '1KI',
  'ii kings': '2KI',
  'i chronicles': '1CH',
  'ii chronicles': '2CH',
  'i corinthians': '1CO',
  'ii corinthians': '2CO',
  'i thessalonians': '1TH',
  'ii thessalonians': '2TH',
  'i timothy': '1TI',
  'ii timothy': '2TI',
  'i peter': '1PE',
  'ii peter': '2PE',
  'i john': '1JN',
  'ii john': '2JN',
  'iii john': '3JN',
}

function normalizeBookKey(book: string): string {
  return book.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** CCEL Matthew Henry div1 titles use "First Samuel" / "Third John" instead of "1 Samuel". */
function expandFirstSecondThirdBookPrefix(key: string): string {
  return key
    .replace(/^first /, '1 ')
    .replace(/^second /, '2 ')
    .replace(/^third /, '3 ')
}

export function bookNameToUsfm(book: string): string | null {
  const key = normalizeBookKey(book)
  if (BOOK_ALIAS_TO_USFM[key]) return BOOK_ALIAS_TO_USFM[key]
  const expanded = expandFirstSecondThirdBookPrefix(key)
  if (expanded !== key && BOOK_ALIAS_TO_USFM[expanded]) return BOOK_ALIAS_TO_USFM[expanded]
  return null
}

/** Distinct USFM book codes used in passage keys (API.Bible style). */
const ALL_USFM_BOOK_CODES = new Set(Object.values(BOOK_ALIAS_TO_USFM))

/**
 * When a query is not a full verse reference, map it to USFM book codes for
 * {@code spurgeon_passage_index} prefix search (any passage in that book).
 * Matches if a canonical alias or any word in an alias starts with the query,
 * or if a USFM code starts with a compact alphanumeric query (e.g. {@code jhn}, {@code 1co}).
 * Single-digit-only queries are ignored as too ambiguous.
 */
/** Collapse spaced letter-by-letter typing (e.g. {@code d u t}) for book-prefix matching. */
function compactBookSearchQuery(query: string): string {
  return query.replace(/\s+/g, '')
}

export function usfmBookPrefixesForSearchQuery(query: string): string[] {
  const raw = query.trim()
  if (!raw) return []

  const q = normalizeBookKey(raw)
  const qCompact = compactBookSearchQuery(q)
  const variants = qCompact !== q && qCompact.length > 0 ? [q, qCompact] : [q]

  const codes = new Set<string>()

  for (const variant of variants) {
    if (!/^[a-z0-9\s]+$/i.test(variant)) continue
    if (variant.length === 1 && /^\d$/.test(variant)) continue

    const exact = BOOK_ALIAS_TO_USFM[variant]
    if (exact) {
      codes.add(exact)
      continue
    }

    for (const [alias, usfm] of Object.entries(BOOK_ALIAS_TO_USFM)) {
      const a = normalizeBookKey(alias)
      if (a.startsWith(variant)) {
        codes.add(usfm)
        continue
      }
      for (const w of a.split(/\s+/)) {
        if (w.length > 0 && w.startsWith(variant)) {
          codes.add(usfm)
          break
        }
      }
    }

    if (variant.length > 0 && /^[0-9a-z]+$/i.test(variant)) {
      const cl = variant.toUpperCase()
      for (const code of ALL_USFM_BOOK_CODES) {
        if (code.toLowerCase().startsWith(cl.toLowerCase())) {
          codes.add(code)
        }
      }
    }
  }

  return [...codes]
}

/**
 * Build API.Bible passageId from a user reference like "John 3:16".
 */
export function referenceToApiBiblePassageId(reference: string): string | null {
  const parsed = parseReference(reference.trim())
  if (!parsed) return null

  const code = bookNameToUsfm(parsed.book)
  if (!code) return null

  const { chapter, verseStart, verseEnd } = parsed

  if (verseStart === null) {
    return `${code}.${chapter}`
  }

  const startId = `${code}.${chapter}.${verseStart}`
  if (verseEnd !== null && verseEnd !== verseStart) {
    return `${startId}-${code}.${chapter}.${verseEnd}`
  }
  return startId
}

/**
 * Stable key for `scripture_cache.reference`: same USFM passage id as API.Bible / {@link referenceToApiBiblePassageId}
 * when the reference parses (unifies Psalm/Psalms, `:4a` → `:4`, en-dash ranges). Falls back to trimmed/suffix-stripped
 * text if parsing fails.
 */
export function canonicalScriptureCacheReference(reference: string): string {
  const passageId = referenceToApiBiblePassageId(reference)
  if (passageId) return passageId
  return reference.replace(/–/g, '-').replace(/(\d+)[a-z]+/g, '$1').trim()
}



// ----- api-bible-audio.ts -----

const API_BIBLE_ID_ENV: Record<ApiBibleTranslation, string> = {
  kjv: 'API_BIBLE_BIBLE_ID_KJV',
  nasb: 'API_BIBLE_BIBLE_ID_NASB',
  lsb: 'API_BIBLE_BIBLE_ID_LSB',
  niv: 'API_BIBLE_BIBLE_ID_NIV',
  nlt: 'API_BIBLE_BIBLE_ID_NLT',
  csb: 'API_BIBLE_BIBLE_ID_CSB',
}

/** Optional override when auto-discovery picks the wrong linked audio Bible (e.g. LSB text vs another edition). */
const API_BIBLE_AUDIO_ID_ENV: Record<ApiBibleTranslation, string> = {
  kjv: 'API_BIBLE_AUDIO_BIBLE_ID_KJV',
  nasb: 'API_BIBLE_AUDIO_BIBLE_ID_NASB',
  lsb: 'API_BIBLE_AUDIO_BIBLE_ID_LSB',
  niv: 'API_BIBLE_AUDIO_BIBLE_ID_NIV',
  nlt: 'API_BIBLE_AUDIO_BIBLE_ID_NLT',
  csb: 'API_BIBLE_AUDIO_BIBLE_ID_CSB',
}

type BibleMetaResponse = {
  data?: {
    id?: string
    dblId?: string
    name?: string
    nameLocal?: string
    abbreviation?: string
    abbreviationLocal?: string
    audioBibles?: Array<{ id?: string }>
  }
}

type AudioBibleListRow = {
  id?: string
  type?: string
  abbreviation?: string
  abbreviationLocal?: string
  name?: string
  nameLocal?: string
  dblId?: string
}

type AudioBibleListResponse = {
  data?: AudioBibleListRow[]
}

type AudioChapterResponse = {
  data?: {
    resourceUrl?: string
  }
}

type AudioBookChaptersListResponse = {
  data?: Array<{
    id?: string
    number?: string
    bookId?: string
  }>
}

function uniqueIds(ids: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

function embeddedAudioBibleIds(bibleJson: BibleMetaResponse): string[] {
  const embedded = bibleJson?.data?.audioBibles
  if (!Array.isArray(embedded)) return []
  return uniqueIds(embedded.map((e) => e?.id).filter((x): x is string => Boolean(x)))
}

/**
 * `GET /v1/audio-bibles?bibleId=` — per OpenAPI, filter by related text `bibleId`.
 * Prefer `type: "audio"`; if the API returns rows with missing/mis-typed `type` (empty strict list),
 * fall back to any `id` other than the text edition id (runtime evidence: CSB had 0 strict matches but needs audio id).
 */
function listAudioBibleIdsFromListJson(
  listJson: AudioBibleListResponse,
  textBibleId: string
): string[] {
  const rows = listJson?.data
  if (!Array.isArray(rows) || rows.length === 0) return []

  const pass = (r: { id?: string; type?: string } | undefined) => {
    if (!r?.id) return false
    if (r.type === 'text') return false
    return r.type === 'audio' || r.type == null
  }
  const primary = rows.filter((r) => r?.id && r?.type === 'audio').map((r) => r!.id!)
  const rest = rows
    .filter((r) => {
      const id = r?.id
      return id != null && !primary.includes(id) && pass(r)
    })
    .map((r) => r!.id!)
  const strict = uniqueIds([...primary, ...rest])
  if (strict.length > 0) return strict

  const loose = rows
    .map((r) => r?.id)
    .filter((id): id is string => Boolean(id) && id !== textBibleId)
  return uniqueIds(loose)
}

async function fetchListAudioBibleRows(
  base: string,
  apiKey: string,
  textBibleId: string
): Promise<AudioBibleListRow[]> {
  /** List Audio Bibles accepts `bibleId` (+ filters); `limit`/`offset` are not in the public schema and return 400 on rest.api.bible. */
  const listUrl = `${base}/v1/audio-bibles?${new URLSearchParams({ bibleId: textBibleId })}`
  const listRes = await fetch(listUrl, { headers: { 'api-key': apiKey } })
  if (!listRes.ok) {
    return []
  }
  const listJson = (await listRes.json()) as AudioBibleListResponse
  const rows = listJson?.data
  return Array.isArray(rows) ? rows : []
}

/** Same DBL edition as the configured text Bible (`GET /v1/bibles/{textBibleId}`). */
function filterAudioBiblesByDblId(
  rows: AudioBibleListRow[],
  textMeta: BibleMetaResponse['data'] | undefined,
  textBibleId: string
): string[] {
  const dblId = textMeta?.dblId?.trim()
  if (!dblId) return []
  return uniqueIds(
    rows
      .filter(
        (r) =>
          r?.id &&
          r.id !== textBibleId &&
          r.type !== 'text' &&
          Boolean(r.dblId?.trim()) &&
          r.dblId === dblId
      )
      .map((r) => r.id!)
  )
}

/**
 * Audio ids from `GET /v1/audio-bibles?bibleId={textBibleId}` that match that text edition
 * (DBL id, then abbreviation/name). Never falls back to unrelated linked rows.
 */
async function audioBibleIdsLinkedToTextBible(
  base: string,
  apiKey: string,
  rows: AudioBibleListRow[],
  textBibleId: string,
  textMeta: BibleMetaResponse['data'] | undefined
): Promise<string[]> {
  if (rows.length === 0 || !textMeta) {
    return []
  }

  let ids = filterAudioBiblesByDblId(rows, textMeta, textBibleId)
  if (ids.length === 0) {
    ids = applyWideFilters(rows, textMeta, textBibleId)
  }
  if (ids.length === 0) {
    const enriched = await enrichAudioBibleListRows(base, apiKey, rows)
    ids = filterAudioBiblesByDblId(enriched, textMeta, textBibleId)
    if (ids.length === 0) {
      ids = applyWideFilters(enriched, textMeta, textBibleId)
    }
  }
  return ids
}

/**
 * When `?bibleId=` returns no usable ids, OpenAPI also supports
 * `GET /v1/audio-bibles?language=eng&abbreviation=…` to discover audio Bible ids.
 */
async function searchAudioBibleIdsByAbbreviation(
  base: string,
  apiKey: string,
  abbrev: string,
  textBibleId: string
): Promise<string[]> {
  const q = abbrev.trim()
  if (!q) return []

  const listUrl = `${base}/v1/audio-bibles?${new URLSearchParams({ language: 'eng', abbreviation: q })}`
  const listRes = await fetch(listUrl, { headers: { 'api-key': apiKey } })
  if (!listRes.ok) return []
  const listJson = (await listRes.json()) as AudioBibleListResponse
  return listAudioBibleIdsFromListJson(listJson, textBibleId)
}

/** OpenAPI: `name` search on `GET /v1/audio-bibles`. */
async function searchAudioBibleIdsByName(
  base: string,
  apiKey: string,
  name: string,
  textBibleId: string
): Promise<string[]> {
  const q = name.trim().slice(0, 80)
  if (q.length < 2) return []
  const listUrl = `${base}/v1/audio-bibles?${new URLSearchParams({ language: 'eng', name: q })}`
  const listRes = await fetch(listUrl, { headers: { 'api-key': apiKey } })
  if (!listRes.ok) return []
  const listJson = (await listRes.json()) as AudioBibleListResponse
  return listAudioBibleIdsFromListJson(listJson, textBibleId)
}

function uniqueAbbrevSearchQueries(d: BibleMetaResponse['data'] | undefined): string[] {
  if (!d) return []
  const out: string[] = []
  const loc = d.abbreviationLocal?.trim()
  const ab = d.abbreviation?.trim()
  if (loc) out.push(loc)
  if (ab) out.push(ab)
  if (ab && /^eng/i.test(ab) && ab.length > 3) {
    const rest = ab.replace(/^eng/i, '')
    if (rest) out.push(rest)
  }
  return uniqueIds(out)
}

function uniqueNameSearchQueries(d: BibleMetaResponse['data'] | undefined): string[] {
  if (!d) return []
  const out: string[] = []
  if (d.nameLocal?.trim()) out.push(d.nameLocal.trim().slice(0, 64))
  if (d.name?.trim()) out.push(d.name.slice(0, 64))
  return uniqueIds(out)
}

/**
 * If targeted searches return nothing, list all `language=eng` audio bibles and pick rows
 * whose abbreviation fields match the text edition (runtime: CSB search-by-one-abbrev returned 0).
 */
function normAbbrevKey(s: string | undefined | null): string {
  if (!s) return ''
  return s.trim().replace(/^eng/i, '').toLowerCase()
}

function sortLetters(s: string): string {
  return s.split('').sort().join('')
}

/** `engcbs1da` does not include substring "csb" (it has "cbs") — use sorted-letter match on letter-only windows. */
function letterOnly(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

function hasSameLettersWindow(hay: string, needle: string): boolean {
  if (needle.length < 2 || hay.length < needle.length) return false
  const n = sortLetters(needle)
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    if (sortLetters(hay.slice(i, i + needle.length)) === n) return true
  }
  return false
}

/**
 * Text edition (e.g. `abbreviationLocal: "CSB"`) and audio-bible list rows (e.g. `ENGCBS…`, `CBS`) often
 * do not share identical normalized strings, so the wide `language=eng` list can yield no abbreviation match
 * without substring / anagram fallbacks and optional row enrichment.
 */
function textEditionAbbrevMatchesRow(textKeys: string[], r: AudioBibleListRow): boolean {
  const fields: string[] = []
  for (const f of [r.abbreviation, r.abbreviationLocal]) {
    if (f) fields.push(f.trim().toLowerCase(), normAbbrevKey(f))
  }
  const rawLetters = letterOnly(`${r.abbreviation ?? ''} ${r.abbreviationLocal ?? ''}`)
  for (const tk of textKeys) {
    if (!tk) continue
    for (const f of fields) {
      if (!f) continue
      if (f === tk) return true
      if (f.includes(tk) || tk.includes(f)) return true
      if (tk.length >= 3 && f.length >= 3 && tk.length === f.length && tk.length <= 8 && sortLetters(tk) === sortLetters(f)) {
        return true
      }
    }
    if (tk.length >= 2 && rawLetters.includes(tk)) return true
    if (tk.length >= 3 && hasSameLettersWindow(rawLetters, tk)) return true
  }
  return false
}

function filterAudioBiblesByTextAbbrev(
  rows: AudioBibleListRow[] | undefined,
  d: BibleMetaResponse['data'] | undefined,
  textBibleId: string
): string[] {
  if (!Array.isArray(rows) || !d) return []
  const loc = d.abbreviationLocal?.trim()
  const ab = d.abbreviation?.trim()
  if (!loc && !ab) return []
  const textKeys = uniqueIds(
    [loc, ab, normAbbrevKey(loc), normAbbrevKey(ab)]
      .map((s) => (typeof s === 'string' && s ? s : ''))
      .map((s) => s.toLowerCase())
  ).filter((k) => k.length > 0)
  return uniqueIds(
    rows
      .filter((r) => {
        if (!r?.id || r.id === textBibleId) return false
        if (r.type === 'text') return false
        return textEditionAbbrevMatchesRow(textKeys, r)
      })
      .map((r) => r.id)
  )
}

function hasTextEditionAbbrev(d: BibleMetaResponse['data'] | undefined): boolean {
  return Boolean(d?.abbreviationLocal?.trim() || d?.abbreviation?.trim())
}

const NAME_MATCH_STOP = new Set(['bible', 'holy', 'the', 'and', 'of', 'for', 'a', 'an', 'in', 'to', 'is', 'on', 'at'])

/**
 * List responses often include `name` / `nameLocal` but not abbrevs; match distinctive edition words
 * (runtime: `fromWideFiltered: 0` with `wideRowsTotal: 2` for CSB/LSB).
 */
function filterAudioBiblesByTextName(
  rows: AudioBibleListRow[] | undefined,
  d: BibleMetaResponse['data'] | undefined,
  textBibleId: string
): string[] {
  if (!Array.isArray(rows) || !d) return []
  const edition = `${d.nameLocal ?? ''} ${d.name ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
  const words = edition
    .split(' ')
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 4 && !NAME_MATCH_STOP.has(w))
  const fromAbbrev = uniqueIds(
    [d.abbreviationLocal, d.abbreviation, normAbbrevKey(d.abbreviationLocal), normAbbrevKey(d.abbreviation)]
      .map((s) => (s ? letterOnly(s) : ''))
      .filter((s) => s.length >= 3 && s.length <= 10)
  )
  const needles = uniqueIds([...words, ...fromAbbrev])
  if (needles.length === 0) return []
  return uniqueIds(
    rows
      .filter((r) => {
        if (!r?.id || r.id === textBibleId) return false
        if (r.type === 'text') return false
        const rns = `${r.nameLocal ?? ''} ${r.name ?? ''}`.toLowerCase()
        if (rns.length < 3) return false
        return needles.some((n) => rns.includes(n))
      })
      .map((r) => r.id)
  )
}

function applyWideFilters(rows: AudioBibleListRow[] | undefined, d: BibleMetaResponse['data'] | undefined, textBibleId: string): string[] {
  if (!Array.isArray(rows) || !d) return []
  if (hasTextEditionAbbrev(d)) {
    const byAb = filterAudioBiblesByTextAbbrev(rows, d, textBibleId)
    if (byAb.length) return byAb
  }
  return filterAudioBiblesByTextName(rows, d, textBibleId)
}

/** When list rows omit abbreviations, `GET /v1/audio-bibles/{id}` returns full metadata. */
async function enrichAudioBibleListRows(
  base: string,
  apiKey: string,
  rows: AudioBibleListRow[]
): Promise<AudioBibleListRow[]> {
  const out: AudioBibleListRow[] = []
  for (const r of rows) {
    if (r.abbreviation || r.abbreviationLocal) {
      out.push(r)
      continue
    }
    if (!r.id) {
      out.push(r)
      continue
    }
    const res = await fetch(`${base}/v1/audio-bibles/${encodeURIComponent(r.id)}`, { headers: { 'api-key': apiKey } })
    if (!res.ok) {
      out.push(r)
      continue
    }
    const j = (await res.json()) as { data?: AudioBibleListRow }
    if (j.data && typeof j.data === 'object') {
      out.push({ ...r, ...j.data })
    } else {
      out.push(r)
    }
  }
  return out
}

/**
 * `GET /v1/audio-bibles?language=eng` — list endpoint does not support `limit`/`offset` in the documented
 * contract; those params can return 400 and empty discovery.
 * OpenAPI for another product listed limit/offset for *search*; do not send them here.
 */
async function listAllEnglishAudioBibleRows(
  base: string,
  apiKey: string
): Promise<{ rows: AudioBibleListRow[]; pages: number } | undefined> {
  const listUrl = `${base}/v1/audio-bibles?${new URLSearchParams({ language: 'eng' })}`
  const listRes = await fetch(listUrl, { headers: { 'api-key': apiKey } })
  if (!listRes.ok) {
    return undefined
  }
  const listJson = (await listRes.json()) as AudioBibleListResponse
  const rows = listJson.data
  if (!Array.isArray(rows)) return undefined
  return { rows, pages: 1 }
}

/**
 * Tries: multiple abbreviation query strings, name query, then full `language=eng` list
 * matched by abbreviation fields to the text Bible.
 */
async function discoverAudioBibleIdsFromTextMetadata(
  base: string,
  apiKey: string,
  textBibleId: string,
  d: BibleMetaResponse['data'] | undefined
): Promise<string[]> {
  for (const ab of uniqueAbbrevSearchQueries(d)) {
    const ids = await searchAudioBibleIdsByAbbreviation(base, apiKey, ab, textBibleId)
    if (ids.length) return ids
  }
  for (const nm of uniqueNameSearchQueries(d)) {
    const ids = await searchAudioBibleIdsByName(base, apiKey, nm, textBibleId)
    if (ids.length) return ids
  }
  const wideRes = await listAllEnglishAudioBibleRows(base, apiKey)
  const wide = wideRes?.rows
  let fromWide = applyWideFilters(wide, d, textBibleId)
  let merged: AudioBibleListRow[] | undefined
  if (fromWide.length === 0 && Array.isArray(wide) && wide.length > 0) {
    merged = await enrichAudioBibleListRows(base, apiKey, wide)
    fromWide = applyWideFilters(merged, d, textBibleId)
  }
  if (fromWide.length) return fromWide
  const dblSource = merged ?? wide
  if (d?.dblId && Array.isArray(dblSource)) {
    return uniqueIds(
      dblSource
        .filter(
          (r) =>
            r?.id &&
            r.id !== textBibleId &&
            r.type !== 'text' &&
            Boolean(r.dblId && d.dblId && r.dblId === d.dblId)
        )
        .map((r) => r.id!)
    )
  }
  return []
}

/**
 * If `GET /audio-bibles/.../chapters/{id}` 404s, OpenAPI also exposes
 * `GET /audio-bibles/.../books/{bookId}/chapters` — resolve the chapter `id` from that list
 * (same USFM as text; `number` matches the chapter).
 */
async function resolveChapterIdViaBookList(
  base: string,
  apiKey: string,
  audioBibleId: string,
  usfmBook: string,
  chapterNumber: number,
  constructedChapterId: string
): Promise<string | null> {
  const listUrl = `${base}/v1/audio-bibles/${encodeURIComponent(audioBibleId)}/books/${encodeURIComponent(usfmBook)}/chapters`
  const listRes = await fetch(listUrl, { headers: { 'api-key': apiKey } })
  if (!listRes.ok) return null
  const listJson = (await listRes.json()) as AudioBookChaptersListResponse
  const rows = listJson?.data
  if (!Array.isArray(rows) || rows.length === 0) return null

  const n = String(chapterNumber)
  const match =
    rows.find((c) => c.id === constructedChapterId) ??
    rows.find((c) => c.number === n && (c.bookId == null || c.bookId === usfmBook)) ??
    rows.find((c) => c.number === n)

  if (match?.id && match.id !== constructedChapterId) return match.id
  if (match?.id) return null
  return null
}

async function fetchAudioChapterResourceUrl(
  base: string,
  apiKey: string,
  audioBibleId: string,
  chapterId: string,
  usfmBook: string,
  chapterNumber: number
): Promise<string | null> {
  const getPayload = async (cid: string): Promise<string | null> => {
    const chapterUrl = `${base}/v1/audio-bibles/${encodeURIComponent(audioBibleId)}/chapters/${encodeURIComponent(cid)}`
    const chapterRes = await fetch(chapterUrl, { headers: { 'api-key': apiKey } })
    if (!chapterRes.ok) return null
    const chapterJson = (await chapterRes.json()) as AudioChapterResponse
    const resourceUrl = chapterJson?.data?.resourceUrl
    if (typeof resourceUrl !== 'string' || !resourceUrl.trim()) {
      return null
    }
    return resourceUrl
  }

  let url = await getPayload(chapterId)
  if (url) return url

  const resolved = await resolveChapterIdViaBookList(
    base,
    apiKey,
    audioBibleId,
    usfmBook,
    chapterNumber,
    chapterId
  )
  if (resolved) {
    url = await getPayload(resolved)
    if (url) return url
  }

  return null
}

async function tryAudioBibleIds(
  base: string,
  apiKey: string,
  chapterId: string,
  usfmBook: string,
  chapterNumber: number,
  ids: string[],
  tried: Set<string>
): Promise<string | null> {
  for (const id of ids) {
    if (tried.has(id)) continue
    tried.add(id)
    const url = await fetchAudioChapterResourceUrl(base, apiKey, id, chapterId, usfmBook, chapterNumber)
    if (url) return url
  }
  return null
}

/**
 * Resolves a time-limited MP3 URL for the chapter containing the passage.
 * Env `API_BIBLE_BIBLE_ID_*` is the **text** edition id for `/v1/bibles/...`. Audio uses
 * `GET /v1/audio-bibles/{audioBibleId}/chapters/...` where `audioBibleId` is a different id but must
 * be linked to that same text bible (`data.audioBibles` or `GET /v1/audio-bibles?bibleId={textBibleId}`
 * with matching DBL id / edition abbreviation), not another translation that happens to resolve first.
 * @see https://api.bible/api-reference — “Audio Bibles” (GET `/v1/audio-bibles`, `/v1/audio-bibles/.../chapters/...`)
 */
export async function resolveApiBiblePassageAudioUrl(
  reference: string,
  translation: ApiBibleTranslation
): Promise<string | null> {
  const apiKey = Deno.env.get('API_BIBLE_KEY')
  if (!apiKey) {
    return null
  }

  const envName = API_BIBLE_ID_ENV[translation]
  const textBibleId = Deno.env.get(envName)?.trim()
  if (!textBibleId) {
    return null
  }

  const parsed = parseReference(reference.trim())
  if (!parsed) {
    return null
  }

  const usfm = bookNameToUsfm(parsed.book)
  if (!usfm) {
    return null
  }

  const chapterId = `${usfm}.${parsed.chapter}`
  const base = (Deno.env.get('API_BIBLE_BASE_URL') ?? 'https://rest.api.bible').replace(/\/$/, '')

  const [bibleRes, listRows] = await Promise.all([
    fetch(`${base}/v1/bibles/${encodeURIComponent(textBibleId)}`, {
      headers: { 'api-key': apiKey },
    }),
    fetchListAudioBibleRows(base, apiKey, textBibleId),
  ])

  let fromEmbed: string[] = []
  let textMeta: BibleMetaResponse['data'] | undefined
  if (bibleRes.ok) {
    const bj = (await bibleRes.json()) as BibleMetaResponse
    fromEmbed = embeddedAudioBibleIds(bj)
    textMeta = bj.data
  }

  const envAudioId = Deno.env.get(API_BIBLE_AUDIO_ID_ENV[translation])?.trim()
  const fromList = await audioBibleIdsLinkedToTextBible(
    base,
    apiKey,
    listRows,
    textBibleId,
    textMeta
  )

  let fromDiscover: string[] = []
  if (fromEmbed.length === 0 && fromList.length === 0 && textMeta) {
    fromDiscover = await discoverAudioBibleIdsFromTextMetadata(base, apiKey, textBibleId, textMeta)
  }

  const candidates = uniqueIds([
    ...(envAudioId ? [envAudioId] : []),
    ...fromEmbed,
    ...fromList,
    ...fromDiscover,
  ])
  if (candidates.length === 0) {
    return null
  }

  const tried = new Set<string>()
  const out = await tryAudioBibleIds(base, apiKey, chapterId, usfm, parsed.chapter, candidates, tried)
  return out
}



const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

async function resolveEsvPassageAudioUrl(reference: string): Promise<string | null> {
  const apiToken = Deno.env.get('ESV_API_TOKEN');
  if (!apiToken) return null;
  const q = scriptureReferenceForPassageQuery(reference.trim());
  if (!q) return null;

  let url = `https://api.esv.org/v3/passage/audio/?q=${encodeURIComponent(q)}`;
  for (let hop = 0; hop < 8; hop += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${apiToken}` },
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('location');
      if (!loc) return null;
      url = new URL(loc, url).toString();
      continue;
    }
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('audio') || /\.mp3(\?|$)/i.test(url)) {
      return url;
    }
    return null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference')?.trim();
    const rawTranslation = (url.searchParams.get('translation') || 'esv').toLowerCase();

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Scripture reference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isBibleTranslation(rawTranslation)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid translation. Must be one of: esv, kjv, nasb, lsb, niv, nlt, csb',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (rawTranslation === 'esv') {
      const audioUrl = await resolveEsvPassageAudioUrl(reference);
      if (!audioUrl) {
        if (!Deno.env.get('ESV_API_TOKEN')) {
          return new Response(JSON.stringify({ error: 'ESV audio is not configured.' }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ error: 'Could not resolve ESV audio for this passage.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ audioUrl, useSpeechSynthesis: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isApiBibleTranslation(rawTranslation)) {
      return new Response(JSON.stringify({ audioUrl: null, useSpeechSynthesis: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const translation = rawTranslation as ApiBibleTranslation;
    const audioUrl = await resolveApiBiblePassageAudioUrl(reference, translation);
    if (!audioUrl) {
      return new Response(JSON.stringify({ audioUrl: null, useSpeechSynthesis: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ audioUrl, useSpeechSynthesis: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to load audio.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

