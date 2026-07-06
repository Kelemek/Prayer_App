import type { ApiBibleTranslation, BibleTranslation } from './bible-translations.ts';
import { formatApiBiblePassageContent } from './api-bible-format.ts';
import { referenceToApiBiblePassageId } from './api-bible-passage-id.ts';
import { scriptureReferenceForPassageQuery } from './parse-scripture-reference.ts';

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
