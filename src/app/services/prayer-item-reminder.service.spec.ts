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
});
