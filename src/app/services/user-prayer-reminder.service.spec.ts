import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserPrayerReminderService } from './user-prayer-reminder.service';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';

/** Must match STALE_MS in user-prayer-reminder.service.ts */
const STALE_MS = 10 * 60 * 1000;

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('UserPrayerReminderService', () => {
  let service: UserPrayerReminderService;
  let mockSupabase: { client: { from: ReturnType<typeof vi.fn> } };
  let mockUserSession: { getCurrentSession: ReturnType<typeof vi.fn>; updateUserSession: ReturnType<typeof vi.fn> };
  let selectOrderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selectOrderMock = vi.fn(() =>
      Promise.resolve({ data: [{ id: '1', iana_timezone: 'UTC', local_hour: 9 }], error: null })
    );
    mockSupabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: selectOrderMock,
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      },
    };
    mockUserSession = {
      getCurrentSession: vi.fn(() => ({
        email: 'user@example.com',
      })),
      updateUserSession: vi.fn(() => Promise.resolve()),
    };
    service = new UserPrayerReminderService(
      mockSupabase as unknown as SupabaseService,
      mockUserSession as unknown as UserSessionService
    );
  });

  it('ensureLoaded returns [] when there is no session', async () => {
    mockUserSession.getCurrentSession.mockReturnValue(null);
    await expect(service.ensureLoaded()).resolves.toEqual([]);
  });

  it('ensureLoaded returns [] when email is missing or blank', async () => {
    mockUserSession.getCurrentSession.mockReturnValue({ email: undefined });
    await expect(service.ensureLoaded()).resolves.toEqual([]);

    mockUserSession.getCurrentSession.mockReturnValue({ email: '   ' });
    await expect(service.ensureLoaded()).resolves.toEqual([]);
  });

  it('ensureLoaded fetches when cache undefined', async () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: undefined,
    });
    const slots = await service.ensureLoaded(true);
    expect(slots).toHaveLength(1);
    expect(mockUserSession.updateUserSession).toHaveBeenCalled();
  });

  it('ensureLoaded returns cache when fresh', async () => {
    const cached = [{ id: 'x', iana_timezone: 'UTC', local_hour: 8 }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: cached,
      prayerHourRemindersFetchedAt: Date.now(),
    });
    const slots = await service.ensureLoaded(false);
    expect(slots).toEqual(cached);
    expect(mockSupabase.client.from).not.toHaveBeenCalled();
  });

  it('ensureLoaded returns stale cache and triggers background refresh', async () => {
    const cached = [{ id: 'x', iana_timezone: 'UTC', local_hour: 8 }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: cached,
      prayerHourRemindersFetchedAt: Date.now() - STALE_MS - 1,
    });
    const slots = await service.ensureLoaded(false);
    expect(slots).toEqual(cached);
    expect(mockSupabase.client.from).toHaveBeenCalled();
    await flushMicrotasks();
    expect(mockUserSession.updateUserSession).toHaveBeenCalled();
  });

  it('ensureLoaded swallows background refresh errors when cache is stale', async () => {
    const cached = [{ id: 'x', iana_timezone: 'UTC', local_hour: 8 }];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: cached,
      prayerHourRemindersFetchedAt: Date.now() - STALE_MS - 1,
    });
    selectOrderMock.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

    const slots = await service.ensureLoaded(false);
    expect(slots).toEqual(cached);
    await flushMicrotasks();
  });

  it('ensureLoaded throws when fetch returns error (initial load)', async () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: undefined,
    });
    selectOrderMock.mockResolvedValueOnce({ data: null, error: { message: 'select failed' } });

    await expect(service.ensureLoaded(true)).rejects.toEqual({ message: 'select failed' });
  });

  it('ensureLoaded persists empty slots when data is null', async () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerHourReminders: undefined,
    });
    selectOrderMock.mockResolvedValueOnce({ data: null, error: null });

    const slots = await service.ensureLoaded(true);
    expect(slots).toEqual([]);
    expect(mockUserSession.updateUserSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prayerHourReminders: [],
      })
    );
  });

  it('addSlot inserts and returns updated slots', async () => {
    const slots = await service.addSlot(' user@example.com ', 'America/Chicago', 7);
    expect(slots).toHaveLength(1);
    expect(mockSupabase.client.from).toHaveBeenCalledWith('user_prayer_hour_reminders');
    const fromReturn = mockSupabase.client.from.mock.results[0]?.value;
    expect(fromReturn.insert).toHaveBeenCalledWith({
      user_email: 'user@example.com',
      iana_timezone: 'America/Chicago',
      local_hour: 7,
    });
  });

  it('addSlot throws when insert fails', async () => {
    mockSupabase.client.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: selectOrderMock,
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: { message: 'dup' } })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    }));

    await expect(service.addSlot('user@example.com', 'UTC', 0)).rejects.toEqual({ message: 'dup' });
  });

  it('removeSlot deletes and returns updated slots', async () => {
    const slots = await service.removeSlot(' user@example.com ', 'slot-id-1');
    expect(slots).toHaveLength(1);
    expect(mockSupabase.client.from).toHaveBeenCalledWith('user_prayer_hour_reminders');
    expect(mockUserSession.updateUserSession).toHaveBeenCalled();
  });

  it('removeSlot throws when delete fails', async () => {
    mockSupabase.client.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: selectOrderMock,
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'not found' } })),
        })),
      })),
    }));

    await expect(service.removeSlot('user@example.com', 'bad-id')).rejects.toEqual({ message: 'not found' });
  });
});
