import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrayerItemReminderService } from './prayer-item-reminder.service';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

describe('PrayerItemReminderService', () => {
  let service: PrayerItemReminderService;
  let mockSupabase: { client: { from: ReturnType<typeof vi.fn> } };
  let mockUserSession: {
    getCurrentSession: ReturnType<typeof vi.fn>;
    updateUserSession: ReturnType<typeof vi.fn>;
  };
  let mockTenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };
  let orderMock: ReturnType<typeof vi.fn>;
  let tenantEqMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantEqMock = vi.fn(() => ({
      order: orderMock,
    }));
    orderMock = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: '1',
            tenant_id: 'tenant-1',
            user_email: 'user@example.com',
            prayer_kind: 'community',
            prayer_id: 'p1',
            title_snapshot: 'Title',
            prayer_for_snapshot: 'Alice',
            mode: 'daily',
            iana_timezone: 'UTC',
            local_hour: 9,
            local_minute: 15,
            local_date: null,
            local_weekday: null,
            last_sent_at: null,
            created_at: '2026-08-03T00:00:00Z',
          },
        ],
        error: null,
      })
    );
    mockSupabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: tenantEqMock,
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            })),
          })),
        })),
      },
    };
    mockUserSession = {
      getCurrentSession: vi.fn(() => ({ email: 'user@example.com' })),
      updateUserSession: vi.fn(() => Promise.resolve()),
    };
    mockTenantContext = {
      getActiveTenant: vi.fn(() => ({ id: 'tenant-1', name: 'T', slug: 't' })),
    };
    service = new PrayerItemReminderService(
      mockSupabase as unknown as SupabaseService,
      mockUserSession as unknown as UserSessionService,
      mockTenantContext as unknown as TenantContextService
    );
  });

  it('ensureLoaded returns [] without session', async () => {
    mockUserSession.getCurrentSession.mockReturnValue(null);
    await expect(service.ensureLoaded()).resolves.toEqual([]);
  });

  it('ensureLoaded returns [] without active tenant', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    await expect(service.ensureLoaded()).resolves.toEqual([]);
  });

  it('ensureLoaded fetches and caches', async () => {
    const rows = await service.ensureLoaded(true);
    expect(rows).toHaveLength(1);
    expect(mockUserSession.updateUserSession).toHaveBeenCalled();
    expect(tenantEqMock).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  });

  it('filters reminders by prayer id and kind', async () => {
    const rows = await service.ensureLoaded(true);
    const filtered = service.remindersForPrayer(rows, 'p1', 'community');
    expect(filtered).toHaveLength(1);
    expect(service.remindersForPrayer(rows, 'missing', 'community')).toEqual([]);
  });

  it('drops cached reminders for a deleted prayer', () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerItemReminders: [
        {
          id: '1',
          prayer_id: 'p1',
          prayer_kind: 'community',
        },
      ],
    });
    service.dropRemindersForPrayer('p1', 'community');
    expect(mockUserSession.updateUserSession).toHaveBeenCalledWith({
      prayerItemReminders: [],
    });
  });

  it('addReminder rejects duplicate schedules', async () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerItemReminders: [
        {
          prayer_kind: 'community',
          prayer_id: 'p1',
          mode: 'once',
          local_hour: 10,
          local_minute: 0,
          local_date: '2026-08-04',
          local_weekday: null,
        },
      ],
    });
    await expect(
      service.addReminder('user@example.com', {
        prayer_kind: 'community',
        prayer_id: 'p1',
        title_snapshot: 'T',
        prayer_for_snapshot: 'Alice',
        mode: 'once',
        iana_timezone: 'UTC',
        local_hour: 10,
        local_minute: 0,
        local_date: '2026-08-04',
      })
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('removeReminder deletes row and refreshes session', async () => {
    const rows = await service.removeReminder('user@example.com', '1');
    expect(rows).toHaveLength(1);
  });

  it('addReminder requires tenant', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    await expect(
      service.addReminder('user@example.com', {
        prayer_kind: 'community',
        prayer_id: 'p1',
        title_snapshot: 'T',
        prayer_for_snapshot: 'Alice',
        mode: 'once',
        iana_timezone: 'UTC',
        local_hour: 10,
        local_minute: 0,
        local_date: '2026-08-04',
      })
    ).rejects.toThrow('Select an organization first.');
  });

  it('ensureLoaded returns fresh cache without refetching', async () => {
    const cached = [
      {
        id: 'cached',
        tenant_id: 'tenant-1',
        user_email: 'user@example.com',
        prayer_kind: 'community',
        prayer_id: 'p9',
        title_snapshot: 'T',
        prayer_for_snapshot: 'Bob',
        mode: 'daily',
        iana_timezone: 'UTC',
        local_hour: 8,
        local_minute: 0,
        local_date: null,
        local_weekday: null,
        last_sent_at: null,
        created_at: '2026-08-03T00:00:00Z',
      },
    ];
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerItemReminders: cached,
      prayerItemRemindersFetchedAt: Date.now(),
    });
    const rows = await service.ensureLoaded(false);
    expect(rows).toEqual(cached);
    expect(mockSupabase.client.from).not.toHaveBeenCalled();
  });

  it('dropRemindersForPrayer is a no-op when nothing matches', () => {
    mockUserSession.getCurrentSession.mockReturnValue({
      email: 'user@example.com',
      prayerItemReminders: [
        {
          id: '1',
          prayer_id: 'other',
          prayer_kind: 'community',
        },
      ],
    });
    service.dropRemindersForPrayer('p1', 'community');
    expect(mockUserSession.updateUserSession).not.toHaveBeenCalled();
  });

  it('addReminder inserts and refreshes session', async () => {
    const rows = await service.addReminder('user@example.com', {
      prayer_kind: 'community',
      prayer_id: 'p-new',
      title_snapshot: 'Title',
      prayer_for_snapshot: 'Alice',
      mode: 'weekly',
      iana_timezone: 'America/Chicago',
      local_hour: 7,
      local_minute: 30,
      local_weekday: 1,
    });
    expect(rows).toHaveLength(1);
    expect(mockSupabase.client.from).toHaveBeenCalled();
  });

  it('removeReminder requires tenant', async () => {
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    await expect(service.removeReminder('user@example.com', '1')).rejects.toThrow(
      'Select an organization first.'
    );
  });

  it('ensureLoaded throws when fetch fails', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: new Error('db down') });
    await expect(service.ensureLoaded(true)).rejects.toThrow('db down');
  });
});
