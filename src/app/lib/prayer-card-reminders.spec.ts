import { describe, it, expect, vi } from 'vitest';
import {
  ensurePrayerCardItemRemindersLoaded,
  loadPrayerCardItemReminders,
  remindersForPrayerCard,
} from './prayer-card-reminders';
import type { PrayerItemReminderService } from '../services/prayer-item-reminder.service';
import type { UserSessionService } from '../services/user-session.service';
import type { PrayerItemReminder } from '../types/prayer-item-reminder';

function makeReminder(
  overrides: Partial<PrayerItemReminder> = {}
): PrayerItemReminder {
  return {
    id: 'rem-1',
    tenant_id: 'tenant-1',
    user_email: 'user@example.com',
    prayer_kind: 'prompt',
    prayer_id: 'prompt-abc',
    title_snapshot: 'Title',
    prayer_for_snapshot: 'Family',
    mode: 'daily',
    iana_timezone: 'America/Chicago',
    local_hour: 9,
    local_minute: 0,
    local_date: null,
    local_weekday: null,
    last_sent_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('remindersForPrayerCard', () => {
  const reminderService = {
    remindersForPrayer: vi.fn(
      (
        all: PrayerItemReminder[],
        prayerId: string,
        prayerKind: PrayerItemReminder['prayer_kind']
      ) =>
        all.filter(
          (r) => r.prayer_id === prayerId && r.prayer_kind === prayerKind
        )
    ),
  } as unknown as PrayerItemReminderService;

  const userSessionService = {
    getCurrentSession: vi.fn(() => ({
      email: 'user@example.com',
      prayerItemReminders: [makeReminder()],
    })),
  } as unknown as UserSessionService;

  it('uses prayer_kind prompt for prompt cards', () => {
    const rows = remindersForPrayerCard(
      reminderService,
      userSessionService,
      [],
      'prompt-abc',
      false,
      true
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.prayer_kind).toBe('prompt');
  });

  it('returns no rows when prayerId is empty', () => {
    expect(
      remindersForPrayerCard(
        reminderService,
        userSessionService,
        [],
        '',
        false,
        false
      )
    ).toEqual([]);
  });

  it('does not show prompt reminders when isPrompt is false', () => {
    const rows = remindersForPrayerCard(
      reminderService,
      userSessionService,
      [],
      'prompt-abc',
      false,
      false
    );

    expect(rows).toHaveLength(0);
  });
});

describe('loadPrayerCardItemReminders', () => {
  it('retries once when the first load fails', async () => {
    const ensureLoaded = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([makeReminder()]);
    const rows = await loadPrayerCardItemReminders({
      ensureLoaded,
    } as unknown as PrayerItemReminderService);
    expect(ensureLoaded).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(1);
  });

  it('returns an empty list when retry also fails', async () => {
    const ensureLoaded = vi.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = await loadPrayerCardItemReminders({
      ensureLoaded,
    } as unknown as PrayerItemReminderService);
    expect(rows).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe('ensurePrayerCardItemRemindersLoaded', () => {
  it('reads reminders from session when already cached', async () => {
    const sessionService = {
      getCurrentSession: () => ({
        email: 'user@example.com',
        prayerItemReminders: [makeReminder({ id: 'cached' })],
      }),
    } as unknown as UserSessionService;
    const ensureLoaded = vi.fn();
    const rows = await ensurePrayerCardItemRemindersLoaded(
      sessionService,
      { ensureLoaded } as unknown as PrayerItemReminderService
    );
    expect(rows[0]?.id).toBe('cached');
    expect(ensureLoaded).not.toHaveBeenCalled();
  });
});

