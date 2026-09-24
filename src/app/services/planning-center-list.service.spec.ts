import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanningCenterListService } from './planning-center-list.service';
import { fetchListMembers } from '../lib/planning-center';

vi.mock('../lib/planning-center', () => ({
  fetchListMembers: vi.fn(),
}));

const mockedFetchListMembers = vi.mocked(fetchListMembers);

describe('PlanningCenterListService', () => {
  let maybeSingle: ReturnType<typeof vi.fn>;
  let service: PlanningCenterListService;

  const userSession = {
    getCurrentSession: vi.fn(() => null as { email: string } | null),
  };
  const tenantContext = {
    getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle,
        })),
      },
    };
    service = new PlanningCenterListService(
      supabase as never,
      userSession as never,
      tenantContext as never
    );
  });

  it('clears state when loadForCurrentUser has no session email', async () => {
    userSession.getCurrentSession.mockReturnValue(null);
    await service.loadForCurrentUser();
    expect(service.getCurrentListId()).toBeNull();
    expect(service.getCurrentMembers()).toEqual([]);
  });

  it('loads list id and members from server', async () => {
    maybeSingle.mockResolvedValue({
      data: { planning_center_list_id: 'list-1' },
      error: null,
    });
    mockedFetchListMembers.mockResolvedValue({
      members: [{ id: 'm1', name: 'Member' }],
      error: null,
    });

    await service.loadForUser('user@example.com', true);

    expect(service.getCurrentListId()).toBe('list-1');
    expect(service.getCurrentMembers()).toEqual([{ id: 'm1', name: 'Member' }]);
  });

  it('hydrates from cache when fresh', async () => {
    const key = 'prayerapp_planning_center_list_v2_user@example.com';
    localStorage.setItem(
      key,
      JSON.stringify({
        data: {
          email: 'user@example.com',
          tenantId: 'tenant-1',
          listId: 'list-1',
          members: [{ id: 'cached', name: 'Cached' }],
        },
        timestamp: Date.now(),
        ttl: 30 * 60 * 1000,
      })
    );
    maybeSingle.mockResolvedValue({
      data: { planning_center_list_id: 'list-1' },
      error: null,
    });

    await service.loadForUser('user@example.com');

    expect(service.getCurrentMembers()).toEqual([{ id: 'cached', name: 'Cached' }]);
    expect(mockedFetchListMembers).not.toHaveBeenCalled();
  });

  it('invalidateForUser removes cache and clears active state', async () => {
    maybeSingle.mockResolvedValue({
      data: { planning_center_list_id: null },
      error: null,
    });
    await service.loadForUser('user@example.com', true);
    service.invalidateForUser('user@example.com');
    expect(service.getCurrentListId()).toBeNull();
  });

  it('loadForUser with blank email clears state', async () => {
    await service.loadForUser('   ');
    expect(service.getCurrentListId()).toBeNull();
    expect(service.getCurrentMembers()).toEqual([]);
  });

  it('ignores expired cache entries', async () => {
    const key = 'prayerapp_planning_center_list_v2_user@example.com';
    localStorage.setItem(
      key,
      JSON.stringify({
        data: {
          email: 'user@example.com',
          tenantId: 'tenant-1',
          listId: 'list-1',
          members: [{ id: 'stale', name: 'Stale' }],
        },
        timestamp: Date.now() - 60 * 60 * 1000,
        ttl: 30 * 60 * 1000,
      })
    );
    maybeSingle.mockResolvedValue({
      data: { planning_center_list_id: 'list-1' },
      error: null,
    });
    mockedFetchListMembers.mockResolvedValue({
      members: [{ id: 'fresh', name: 'Fresh' }],
      error: null,
    });
    await service.loadForUser('user@example.com', true);
    expect(service.getCurrentMembers()).toEqual([{ id: 'fresh', name: 'Fresh' }]);
  });

  it('clears state when tenant context is missing', async () => {
    tenantContext.getActiveTenant.mockReturnValue(null as never);
    await service.loadForUser('user@example.com', true);
    expect(service.getCurrentListId()).toBeNull();
  });

  it('handles member fetch errors', async () => {
    maybeSingle.mockResolvedValue({
      data: { planning_center_list_id: 'list-1' },
      error: null,
    });
    mockedFetchListMembers.mockResolvedValue({
      members: [],
      error: 'pc down',
    });
    await service.loadForUser('user@example.com', true);
    expect(service.getCurrentMembers()).toEqual([]);
  });

  it('handles list id fetch errors without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    });
    await service.loadForUser('user@example.com', true);
    expect(service.getCurrentMembers()).toEqual([]);
    consoleSpy.mockRestore();
  });
});
