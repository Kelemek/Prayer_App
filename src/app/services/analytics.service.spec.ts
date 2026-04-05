import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';

function createThenableChain(result: { count: number | null; error: Error | null } = { count: 0, error: null }) {
  const p = Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.update = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }));
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    p.then(onFulfilled, onRejected);
  return chain;
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockSupabaseService: any;
  let mockUserSessionService: any;
  let mockTenantContextService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'analytics' || table === 'prayers' || table === 'tenant_memberships') {
          return createThenableChain();
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        };
      })
    };

    mockSupabaseService = {
      client: mockSupabaseClient
    } as unknown as SupabaseService;

    mockUserSessionService = {
      currentSession: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      },
      getCurrentSession: vi.fn(() => ({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }))
    } as unknown as UserSessionService;

    mockTenantContextService = {
      getActiveTenant: vi.fn(() => ({ id: TEST_TENANT_ID, name: 'Test', plan_tier: 'churches', plan_status: 'active' }))
    } as unknown as TenantContextService;

    service = new AnalyticsService(mockSupabaseService, mockUserSessionService, mockTenantContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('trackPageView', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should update user last activity date', async () => {
      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }));

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'email_subscribers') {
          return { update: updateMock };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        };
      });

      await service.trackPageView();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('email_subscribers');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          last_activity_date: expect.any(String)
        })
      );
    });

    it('should include tenant_id on analytics insert when active tenant exists', async () => {
      const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'analytics') {
          return { insert: insertMock };
        }
        if (table === 'email_subscribers') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          };
        }
        return { insert: insertMock };
      });

      await service.trackPageView();

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TEST_TENANT_ID,
          event_type: 'page_view'
        })
      );
    });

    it('should throttle updates - skip if updated within 5 minutes', async () => {
      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }));

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'email_subscribers') {
          return { update: updateMock };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        };
      });

      await service.trackPageView();
      expect(updateMock).toHaveBeenCalledTimes(1);

      await service.trackPageView();
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Insert failed');

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'analytics') {
          return {
            insert: vi.fn(() => Promise.reject(error))
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        };
      });

      await service.trackPageView();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Analytics] Failed to track page view:', error);
      consoleErrorSpy.mockRestore();
    });

    it('should not track if user is not logged in', async () => {
      const insertMock = vi.fn();
      const updateMock = vi.fn();
      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'analytics') {
          return { insert: insertMock };
        }
        return { update: updateMock };
      });

      mockUserSessionService.getCurrentSession = vi.fn(() => null);

      await service.trackPageView();

      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return empty stats when tenant id is missing', async () => {
      const stats = await service.getStats('');

      expect(stats).toEqual({
        todayPageViews: 0,
        weekPageViews: 0,
        monthPageViews: 0,
        yearPageViews: 0,
        totalPageViews: 0,
        totalPrayers: 0,
        currentPrayers: 0,
        answeredPrayers: 0,
        archivedPrayers: 0,
        totalTenantMembers: 0,
        tenantLeadersAndAdmins: 0,
        loading: false
      });
    });

    it('should return default stats structure', async () => {
      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats).toEqual({
        todayPageViews: 0,
        weekPageViews: 0,
        monthPageViews: 0,
        yearPageViews: 0,
        totalPageViews: 0,
        totalPrayers: 0,
        currentPrayers: 0,
        answeredPrayers: 0,
        archivedPrayers: 0,
        totalTenantMembers: 0,
        tenantLeadersAndAdmins: 0,
        loading: false
      });
    });

    it('should fetch and return analytics stats', async () => {
      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats).toEqual(
        expect.objectContaining({
          todayPageViews: expect.any(Number),
          weekPageViews: expect.any(Number),
          monthPageViews: expect.any(Number),
          yearPageViews: expect.any(Number),
          totalPageViews: expect.any(Number),
          totalPrayers: expect.any(Number),
          currentPrayers: expect.any(Number),
          answeredPrayers: expect.any(Number),
          archivedPrayers: expect.any(Number),
          totalTenantMembers: expect.any(Number),
          tenantLeadersAndAdmins: expect.any(Number),
          loading: false
        })
      );
    });

    it('should handle errors for individual stat queries', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Query failed');
      const badChain = createThenableChain({ count: null, error });

      mockSupabaseClient.from = vi.fn(() => badChain);

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.totalPageViews).toBe(0);
      expect(stats.totalPrayers).toBe(0);
      expect(stats.totalTenantMembers).toBe(0);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle exceptions in getStats', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseClient.from = vi.fn(() => {
        throw new Error('Unexpected error');
      });

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.totalPageViews).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching analytics stats:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should calculate correct date ranges', async () => {
      const gteSpy = vi.fn(() => createThenableChain());
      const chain: any = createThenableChain();
      chain.gte = gteSpy;

      mockSupabaseClient.from = vi.fn(() => chain);

      await service.getStats(TEST_TENANT_ID);

      const gteCallsWithDates = gteSpy.mock.calls.filter((call) => call.length > 0 && call[0] === 'created_at');
      expect(gteCallsWithDates.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getStats - comprehensive coverage', () => {
    it('should return stats with positive values from mocked counts', async () => {
      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'analytics') return createThenableChain({ count: 100, error: null });
        if (table === 'prayers') return createThenableChain({ count: 50, error: null });
        if (table === 'tenant_memberships') return createThenableChain({ count: 25, error: null });
        return createThenableChain();
      });

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.totalPageViews).toBe(100);
      expect(stats.todayPageViews).toBe(100);
      expect(stats.totalPrayers).toBe(50);
      expect(stats.currentPrayers).toBe(50);
      expect(stats.totalTenantMembers).toBe(25);
      expect(stats.tenantLeadersAndAdmins).toBe(25);
      expect(stats.loading).toBe(false);
    });

    it('should handle null count values', async () => {
      const chain = createThenableChain({ count: null, error: null });
      mockSupabaseClient.from = vi.fn(() => chain);

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.totalPageViews).toBe(0);
      expect(stats.loading).toBe(false);
    });

    it('should set loading to false in finally block', async () => {
      mockSupabaseClient.from = vi.fn(() => createThenableChain());

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.loading).toBe(false);
    });

    it('should handle Promise.all rejection gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const badChain: any = {
        select: vi.fn(() => badChain),
        eq: vi.fn(() => badChain),
        in: vi.fn(() => badChain),
        gte: vi.fn(() => Promise.reject(new Error('DB error'))),
        then: (_fn: unknown, rej: (e: unknown) => unknown) => Promise.reject(new Error('DB error')).catch(rej)
      };

      mockSupabaseClient.from = vi.fn(() => badChain);

      const stats = await service.getStats(TEST_TENANT_ID);

      expect(stats.loading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('trackPageView - comprehensive coverage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should include valid ISO timestamp', async () => {
      const updateMock: any = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }));

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'email_subscribers') {
          return {
            update: updateMock,
            insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
          };
        }
        if (table === 'analytics') {
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
          };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        };
      });

      const beforeCall = new Date();
      await service.trackPageView();
      const afterCall = new Date();

      expect(updateMock).toHaveBeenCalled();

      const calls: any[] = updateMock.mock.calls;
      if (calls.length > 0) {
        const callArgs = calls[0]?.[0] as { last_activity_date?: string };
        expect(callArgs?.last_activity_date).toBeDefined();

        const timestamp = new Date(callArgs?.last_activity_date ?? '');
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
      }
    });

    it('should handle Promise rejection gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Update error');

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'analytics') {
          return {
            insert: vi.fn(() => Promise.reject(error))
          };
        }
        if (table === 'email_subscribers') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.reject(error))
            }))
          };
        }
        return {
          insert: vi.fn(() => Promise.reject(error)),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.reject(error))
          }))
        };
      });

      await service.trackPageView();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Analytics] Failed to track page view:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
