import { describe, expect, it } from 'vitest';
import { buildSaddleStitchBookletHtml } from './print-booklet-html';
import type { Prayer } from './print-types';

describe('buildSaddleStitchBookletHtml', () => {
  it('renders booklet HTML for prayers', () => {
    const prayers: Prayer[] = [
      {
        id: '1',
        title: 'Pray',
        prayer_for: 'John',
        description: 'Please pray',
        requester: 'Jane',
        status: 'current',
        created_at: '2024-06-01T00:00:00Z',
        prayer_updates: [],
      },
    ];
    const html = buildSaddleStitchBookletHtml(
      prayers,
      'month',
      '',
      null,
      null,
      null,
      [],
      [],
      '/qr.png',
      '/icon.png',
      'Test Church'
    );
    expect(html).toContain('Test Church');
    expect(html).toContain('booklet');
    expect(html).toContain('Current Prayer Requests');
  });

  it('renders answered prayers, updates, prompts, and insert pages', () => {
    const prayers: Prayer[] = [
      {
        id: '1',
        title: 'Current',
        prayer_for: 'John',
        description: 'Long description.\n\nSecond paragraph.',
        requester: 'Jane',
        status: 'current',
        created_at: '2024-06-01T00:00:00Z',
        prayer_updates: [
          { content: 'Update one', created_at: '2024-06-02T00:00:00Z' },
        ],
      },
      {
        id: '2',
        title: 'Answered',
        prayer_for: 'Mary',
        description: 'Thanks',
        requester: 'Bob',
        status: 'answered',
        created_at: '2024-05-01T00:00:00Z',
        prayer_updates: [],
      },
    ];
    const html = buildSaddleStitchBookletHtml(
      prayers,
      'week',
      'https://cdn/logo.png',
      'data:image/png;base64,abc',
      'data:image/png;base64,icon',
      'data:image/png;base64,back',
      [{ typeName: 'Morning', prompts: [{ title: 'Prompt 1' }, { title: 'Prompt 2' }] }],
      [
        {
          id: 'ins-1',
          sort_order: 0,
          label: 'Welcome',
          mime_type: 'image/png',
          image_data: 'data:image/png;base64,insert',
        },
      ],
      '/qr.png',
      '/icon.png',
      'Test Church'
    );
    expect(html).toContain('Answered Prayers');
    expect(html).toContain('Morning Prompts');
    expect(html).toContain('Prompt 1');
    expect(html).toContain('booklet-insert-page');
    expect(html).toContain('booklet-pack-b64');
  });
});
