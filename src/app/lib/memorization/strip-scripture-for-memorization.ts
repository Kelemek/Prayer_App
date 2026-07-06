import { stripHtmlTags } from './stripHtmlTags';

/** Strip HTML and ESV verse markers like [16] before storing memorization text. */
export function stripScriptureForMemorization(text: string): string {
  const plain = stripHtmlTags(text);
  return plain.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}
