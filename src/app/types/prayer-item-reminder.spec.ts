import { describe, it, expect } from 'vitest';
import {
  prayerItemReminderSchedulesMatch,
  resolvePrayerItemKind,
} from './prayer-item-reminder';

describe('prayer-item-reminder types', () => {
  it('resolvePrayerItemKind maps prompt, personal, and community', () => {
    expect(
      resolvePrayerItemKind({ prayerId: '1', isPersonal: false, isPrompt: true })
    ).toBe('prompt');
    expect(resolvePrayerItemKind({ prayerId: '1', isPersonal: true })).toBe('personal');
    expect(resolvePrayerItemKind({ prayerId: '1', isPersonal: false })).toBe('community');
  });

  it('prayerItemReminderSchedulesMatch compares schedule fields', () => {
    const base = {
      prayer_kind: 'personal' as const,
      prayer_id: 'p1',
      mode: 'daily' as const,
      local_hour: 9,
      local_minute: 0,
      local_date: null,
      local_weekday: null,
    };
    expect(
      prayerItemReminderSchedulesMatch(base, {
        prayer_kind: 'personal',
        prayer_id: 'p1',
        mode: 'daily',
        local_hour: 9,
        local_minute: 0,
        iana_timezone: 'America/Chicago',
        title_snapshot: '',
        prayer_for_snapshot: '',
      })
    ).toBe(true);

    expect(
      prayerItemReminderSchedulesMatch(
        { ...base, mode: 'once', local_date: '2025-01-01' },
        {
          prayer_kind: 'personal',
          prayer_id: 'p1',
          mode: 'once',
          local_hour: 9,
          local_minute: 0,
          local_date: '2025-01-01',
          iana_timezone: 'America/Chicago',
          title_snapshot: '',
          prayer_for_snapshot: '',
        }
      )
    ).toBe(true);

    expect(
      prayerItemReminderSchedulesMatch(
        { ...base, mode: 'weekly', local_weekday: 1 },
        {
          prayer_kind: 'personal',
          prayer_id: 'p1',
          mode: 'weekly',
          local_hour: 9,
          local_minute: 0,
          local_weekday: 1,
          iana_timezone: 'America/Chicago',
          title_snapshot: '',
          prayer_for_snapshot: '',
        }
      )
    ).toBe(true);

    expect(
      prayerItemReminderSchedulesMatch(base, {
        prayer_kind: 'community',
        prayer_id: 'p1',
        mode: 'daily',
        local_hour: 9,
        local_minute: 0,
        iana_timezone: 'America/Chicago',
        title_snapshot: '',
        prayer_for_snapshot: '',
      })
    ).toBe(false);
  });
});
