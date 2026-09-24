import { describe, expect, it } from 'vitest';
import { buildPrintPrayerCardHtml } from './print-prayer-card-html';
import type { Prayer } from './print-types';

const prayer = (overrides: Partial<Prayer> = {}): Prayer => ({
  id: 'p1',
  prayer_for: 'Family',
  requester: 'Jane',
  description: 'Please pray',
  status: 'current',
  created_at: '2026-01-15T12:00:00.000Z',
  is_anonymous: false,
  prayer_updates: [],
  ...overrides,
});

describe('buildPrintPrayerCardHtml', () => {
  it('renders full prayer card with answered date and updates', () => {
    const html = buildPrintPrayerCardHtml(
      prayer({
        date_answered: '2026-02-01T12:00:00.000Z',
        prayer_updates: [
          {
            id: 'u1',
            content: 'Update **text**',
            author: 'Bob',
            created_at: new Date().toISOString(),
            is_anonymous: false,
          },
        ],
      })
    );

    expect(html).toContain('Prayer For:');
    expect(html).toContain('Family');
    expect(html).toContain('Answered on');
    expect(html).toContain('Updates (1)');
    expect(html).toContain('Bob');
  });

  it('masks anonymous requesters and update authors', () => {
    const html = buildPrintPrayerCardHtml(
      prayer({
        is_anonymous: true,
        prayer_updates: [
          {
            id: 'u1',
            content: 'Hi',
            author: 'Hidden',
            created_at: new Date().toISOString(),
            is_anonymous: true,
          },
        ],
      })
    );

    expect(html).toContain('Anonymous');
    expect(html).not.toContain('Hidden');
  });

  it('renders compact booklet layout with continued marker and slice markdown', () => {
    const html = buildPrintPrayerCardHtml(
      prayer({ description: 'ignored in slice' }),
      true,
      {
        descriptionMarkdown: 'Slice body',
        partIndex: 1,
        partCount: 2,
        includeUpdates: false,
      }
    );

    expect(html).toContain('booklet-prayer-top');
    expect(html).toContain('(continued)');
    expect(html).toContain('Slice body');
    expect(html).not.toContain('Updates');
  });

  it('includes a single compact update when enabled', () => {
    const html = buildPrintPrayerCardHtml(
      prayer({
        prayer_updates: [
          {
            id: 'u1',
            content: 'Compact update',
            author: 'A',
            created_at: new Date().toISOString(),
          },
        ],
      }),
      true,
      {
        descriptionMarkdown: 'Body',
        partIndex: 0,
        partCount: 1,
        includeUpdates: true,
      }
    );

    expect(html).toContain('Updates (1)');
    expect(html).toContain('Compact update');
  });
});
