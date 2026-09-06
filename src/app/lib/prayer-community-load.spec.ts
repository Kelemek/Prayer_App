import { describe, expect, it } from 'vitest';
import {
  formatApprovedCommunityPrayersFromDb,
  formatApprovedCommunityPrayersFromUpdatesMap,
} from './prayer-community-load';

describe('formatApprovedCommunityPrayersFromUpdatesMap', () => {
  it('maps verse memorization fields from prayer rows', () => {
    const prayers = formatApprovedCommunityPrayersFromUpdatesMap(
      [
        {
          id: 'p1',
          title: 'Mark 1:7',
          description: '[7] And he preached, saying, “After me comes he…” Mark 1:7',
          status: 'current',
          requester: 'Cross Pointe Church',
          prayer_for: 'Verse Memorization',
          type: 'prayer',
          date_requested: '2026-09-05T00:00:00.000Z',
          created_at: '2026-09-05T00:00:00.000Z',
          updated_at: '2026-09-05T00:00:00.000Z',
          content_kind: 'verse_memorization',
          verse_reference: 'Mark 1:7',
          verse_translation: 'esv',
          admin_message: 'Memorize this week.',
        },
      ],
      new Map()
    );

    expect(prayers[0]?.content_kind).toBe('verse_memorization');
    expect(prayers[0]?.verse_reference).toBe('Mark 1:7');
    expect(prayers[0]?.verse_translation).toBe('esv');
    expect(prayers[0]?.admin_message).toBe('Memorize this week.');
  });
});

describe('formatApprovedCommunityPrayersFromDb', () => {
  it('maps verse memorization fields from joined prayer rows', () => {
    const prayers = formatApprovedCommunityPrayersFromDb([
      {
        id: 'p1',
        title: 'Mark 1:7',
        description: '[7] And he preached…',
        status: 'current',
        requester: 'Cross Pointe Church',
        prayer_for: 'Verse Memorization',
        type: 'prayer',
        date_requested: '2026-09-05T00:00:00.000Z',
        created_at: '2026-09-05T00:00:00.000Z',
        updated_at: '2026-09-05T00:00:00.000Z',
        content_kind: 'verse_memorization',
        verse_reference: 'Mark 1:7',
        verse_translation: 'esv',
        admin_message: null,
        prayer_updates: [],
      },
    ]);

    expect(prayers[0]?.content_kind).toBe('verse_memorization');
    expect(prayers[0]?.verse_reference).toBe('Mark 1:7');
  });
});
