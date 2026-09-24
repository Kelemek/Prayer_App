import { describe, expect, it } from 'vitest';
import {
  appendVerseReferenceToDescription,
  verseMemorizationTextForDisplay,
  verseReferenceFromPrayer,
} from './verse-memorization-description';

describe('verse-memorization-description', () => {
  it('verseReferenceFromPrayer prefers verse_reference', () => {
    expect(
      verseReferenceFromPrayer({
        title: 'Title',
        verse_reference: ' John 3:16 ',
      } as never)
    ).toBe('John 3:16');
    expect(verseReferenceFromPrayer({ title: ' Rom 8:28 ' } as never)).toBe('Rom 8:28');
  });

  it('appendVerseReferenceToDescription avoids duplicate reference', () => {
    expect(appendVerseReferenceToDescription('', 'Ref')).toBe('Ref');
    expect(appendVerseReferenceToDescription('Text Ref', 'Ref')).toBe('Text Ref');
    expect(appendVerseReferenceToDescription('Text', 'Ref')).toBe('Text Ref');
  });

  it('verseMemorizationTextForDisplay uses description or reference', () => {
    expect(verseMemorizationTextForDisplay('  For God… ', 'John 3:16')).toContain('John 3:16');
    expect(verseMemorizationTextForDisplay(null, 'John 3:16')).toBe('John 3:16');
  });
});
