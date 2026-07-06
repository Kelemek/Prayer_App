// @ts-nocheck - Deno Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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



// ----- api-bible-format.ts -----
/**
 * Normalize API.Bible passage `content` into `[n] verse` chunks with paragraph breaks
 * so ScriptureModal's `processChapterText` can style verse numbers like ESV.
 *
 * Passage fetches use `content-type=json` (`para` nodes → `\n\n` between paragraphs).
 * Search snippets and legacy cached plain text still go through the string path.
 *
 * Strips occasional publisher markup leaked into plain text (e.g. `#— #` around an em dash).
 */

export type ApiBibleContentNode = {
  name?: string
  type?: string
  text?: string
  attrs?: Record<string, string | string[] | undefined>
  items?: ApiBibleContentNode[]
}

function isApiBibleContentTree(value: unknown): value is ApiBibleContentNode[] {
  return (
    Array.isArray(value) &&
    value.some(
      (node) =>
        node &&
        typeof node === 'object' &&
        (node as ApiBibleContentNode).name === 'para'
    )
  )
}

function appendApiBibleNodes(nodes: readonly ApiBibleContentNode[] | undefined, out: string[]): void {
  if (!nodes?.length) return
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      out.push(node.text)
      continue
    }
    if (node.name === 'verse') {
      const n = node.attrs?.number
      if (typeof n === 'string' && n.trim()) {
        out.push(`[${n.trim()}] `)
      }
      continue
    }
    if (node.name === 'note') {
      continue
    }
    if (node.items?.length) {
      appendApiBibleNodes(node.items, out)
    }
  }
}

function paragraphTextFromApiBibleNodes(nodes: readonly ApiBibleContentNode[] | undefined): string {
  const parts: string[] = []
  appendApiBibleNodes(nodes, parts)
  return finishApiBiblePassageText(parts.join(''))
}

/** Format API.Bible `content-type=json` passage trees into bracket-verse plain text. */
export function formatApiBibleJsonPassageContent(root: readonly ApiBibleContentNode[]): string {
  const paragraphs: string[] = []
  for (const node of root) {
    if (node.name === 'para' && node.items?.length) {
      const para = paragraphTextFromApiBibleNodes(node.items)
      if (para) paragraphs.push(para)
      continue
    }
    const chunk = paragraphTextFromApiBibleNodes([node])
    if (chunk) paragraphs.push(chunk)
  }
  return paragraphs.join('\n\n')
}

function formatVersesArrayJson(
  verses: Array<{ verse?: number; number?: number; text?: string }>
): string {
  return finishApiBiblePassageText(
    verses
      .map((v) => {
        const n = v.verse ?? v.number
        const text = (v.text ?? '').trim()
        if (n == null) return text
        return `[${n}] ${text}`
      })
      .filter(Boolean)
      .join(' ')
  )
}

function formatApiBiblePassageTextFromString(raw: string): string {
  const t = raw.trim().replace(/\r\n/g, '\n')
  if (!t) return t

  if (/\[\d+\]/.test(t)) {
    return finishApiBiblePassageText(t)
  }

  try {
    const parsed = JSON.parse(t) as unknown
    if (isApiBibleContentTree(parsed)) {
      return formatApiBibleJsonPassageContent(parsed)
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { verses?: unknown }).verses)) {
      const verses = (parsed as { verses: Array<{ verse?: number; number?: number; text?: string }> })
        .verses
      return formatVersesArrayJson(verses)
    }
  } catch {
    /* not JSON */
  }

  const lines = t.split(/\n/)
  const parts: string[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(\d{1,3})\s+(.+)$/)
    if (m) {
      parts.push(`[${m[1]}] ${m[2].trim()}`)
    } else if (line.trim()) {
      parts.push(line.trim())
    }
  }
  if (parts.length > 0) {
    return finishApiBiblePassageText(parts.join(' '))
  }

  return finishApiBiblePassageText(t)
}

/** Normalize API.Bible passage `content` (JSON tree or legacy plain text). */
export function formatApiBiblePassageContent(
  raw: string | readonly ApiBibleContentNode[]
): string {
  if (typeof raw === 'string') {
    return formatApiBiblePassageTextFromString(raw)
  }
  return formatApiBibleJsonPassageContent(raw)
}

/** String-only entry point (e.g. Bible search snippets and legacy cached plain text). */
export function formatApiBiblePassageText(raw: string): string {
  return formatApiBiblePassageContent(raw)
}

/** Em/en dash only — avoids touching hyphenated words. */
function stripHashWrappedDashes(s: string): string {
  return s.replace(/#\s*([\u2014\u2013])\s*#/g, '$1')
}

function finishApiBiblePassageText(s: string): string {
  return collapseWhitespace(stripHashWrappedDashes(s))
}

/**
 * Re-run {@link finishApiBiblePassageText} on text read from `scripture_cache` so older rows
 * pick up plain-text fixes without waiting for TTL.
 */
export function normalizeScriptureCachedText(text: string): string {
  return finishApiBiblePassageText(text)
}

/** Collapse whitespace within each paragraph; keep blank-line breaks for ESV paragraph layout. */
function collapseWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}



// ----- bible-api.ts -----

export interface ScriptureResult {
  reference: string;
  text: string;
  translation: BibleTranslation;
}

const API_BIBLE_ID_ENV: Record<ApiBibleTranslation, string> = {
  kjv: 'API_BIBLE_BIBLE_ID_KJV',
  nasb: 'API_BIBLE_BIBLE_ID_NASB',
  lsb: 'API_BIBLE_BIBLE_ID_LSB',
  niv: 'API_BIBLE_BIBLE_ID_NIV',
  nlt: 'API_BIBLE_BIBLE_ID_NLT',
  csb: 'API_BIBLE_BIBLE_ID_CSB',
};

async function fetchFromEsv(reference: string): Promise<ScriptureResult> {
  const apiToken = Deno.env.get('ESV_API_TOKEN');
  if (!apiToken) {
    throw new Error('ESV API token not configured');
  }

  const cleanReference = reference.trim();
  const queryReference = scriptureReferenceForPassageQuery(cleanReference);

  const response = await fetch(
    `https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(queryReference)}&include-headings=false&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-references=false`,
    {
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ESV API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.passages?.length > 0) {
    return {
      reference: cleanReference,
      text: String(data.passages[0]).trim(),
      translation: 'esv',
    };
  }
  throw new Error('Scripture text not found');
}

async function fetchFromApiBible(
  reference: string,
  translation: ApiBibleTranslation
): Promise<ScriptureResult> {
  const apiKey = Deno.env.get('API_BIBLE_KEY');
  if (!apiKey) {
    throw new Error('API.Bible key not configured');
  }

  const envName = API_BIBLE_ID_ENV[translation];
  const bibleId = Deno.env.get(envName);
  if (!bibleId) {
    throw new Error(`API.Bible Bible ID not configured (${envName})`);
  }

  const passageId = referenceToApiBiblePassageId(reference);
  if (!passageId) {
    throw new Error(`Invalid scripture reference format: ${reference}`);
  }

  const base = (Deno.env.get('API_BIBLE_BASE_URL') ?? 'https://rest.api.bible').replace(/\/$/, '');
  const url = `${base}/v1/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(passageId)}?content-type=json&include-verse-numbers=true&include-titles=false`;

  const response = await fetch(url, {
    headers: {
      'api-key': apiKey,
    },
  });

  if (response.status === 404) {
    throw new Error('Scripture text not found');
  }
  if (!response.ok) {
    throw new Error(`API.Bible error: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: { content?: unknown } };
  const content = payload?.data?.content;
  if (content == null || (typeof content === 'string' && !content.trim())) {
    throw new Error('Scripture text not found');
  }

  const text =
    typeof content === 'string'
      ? formatApiBiblePassageContent(content)
      : Array.isArray(content)
        ? formatApiBiblePassageContent(content)
        : '';
  if (!text.trim()) {
    throw new Error('Scripture text not found');
  }

  return {
    reference: reference.trim(),
    text,
    translation,
  };
}

export async function fetchScripture(
  reference: string,
  translation: BibleTranslation = 'esv'
): Promise<ScriptureResult> {
  switch (translation) {
    case 'esv':
      return fetchFromEsv(reference);
    case 'kjv':
    case 'nasb':
    case 'lsb':
    case 'niv':
    case 'nlt':
    case 'csb':
      return fetchFromApiBible(reference, translation);
    default: {
      const _exhaustive: never = translation;
      throw new Error(`Unsupported translation: ${_exhaustive}`);
    }
  }
}



const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const ESV_CACHE_TTL_DAYS = parseInt(Deno.env.get('ESV_CACHE_TTL_DAYS') || '30', 10);
const API_BIBLE_CACHE_TTL_DAYS = parseInt(Deno.env.get('API_BIBLE_CACHE_TTL_DAYS') || '14', 10);

function cacheTtlDaysForTranslation(translation: BibleTranslation): number {
  return translation === 'esv' ? ESV_CACHE_TTL_DAYS : API_BIBLE_CACHE_TTL_DAYS;
}

function errorStatus(message: string): number {
  if (/Scripture text not found/i.test(message)) return 404;
  if (/Invalid scripture reference format:/i.test(message)) return 400;
  if (/Invalid translation/i.test(message)) return 400;
  return 500;
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

    const translation = rawTranslation;
    const passageQueryReference = scriptureReferenceForPassageQuery(reference);
    const cacheReference = canonicalScriptureCacheReference(passageQueryReference);
    const ttlDays = cacheTtlDaysForTranslation(translation);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ttlDays);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: cached } = await supabase
      .from('scripture_cache')
      .select('text')
      .eq('reference', cacheReference)
      .eq('translation', translation)
      .gte('cached_at', cutoff.toISOString())
      .maybeSingle();

    if (cached?.text) {
      const text =
        translation === 'esv' ? cached.text : normalizeScriptureCachedText(cached.text);
      return new Response(
        JSON.stringify({
          reference,
          text,
          translation,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await fetchScripture(passageQueryReference, translation);

    await supabase.from('scripture_cache').upsert(
      {
        reference: cacheReference,
        translation,
        text: result.text,
        cached_at: new Date().toISOString(),
      },
      { onConflict: 'reference,translation' }
    );

    return new Response(
      JSON.stringify({
        reference,
        text: result.text,
        translation: result.translation,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: errorStatus(message),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

