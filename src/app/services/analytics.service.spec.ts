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
      }),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
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
        if (table === 'tenant_memberships') {
          return { update: updateMock };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        };
      });

      await service.trackPageView();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tenant_memberships');
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
        if (table === 'tenant_memberships') {
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
      const updateEqChain: any = {
        eq: vi.fn(function (this: any) {
          return this;
        })
      };
      updateEqChain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);

      const updateMock = vi.fn(() => updateEqChain);

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'tenant_memberships') {
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

  describe('getPageViewTimeSeries', () => {
    it('should return empty array when tenant id is missing', async () => {
      const series = await service.getPageViewTimeSeries('', '24h');
      expect(series).toEqual([]);
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it('should call both bucket RPCs with tenant id and hour bucket for 24h preset', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T18:30:00.000Z'));

      const rpcMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
      mockSupabaseClient.rpc = rpcMock;

      await service.getPageViewTimeSeries(TEST_TENANT_ID, '24h');

      const expected = {
        p_tenant_id: TEST_TENANT_ID,
        p_start: '2024-06-14T18:30:00.000Z',
        p_end: '2024-06-15T18:30:00.000Z',
        p_bucket: 'hour'
      };
      expect(rpcMock).toHaveBeenCalledWith('analytics_page_view_buckets', expected);
      expect(rpcMock).toHaveBeenCalledWith('analytics_approval_buckets', expected);

      vi.useRealTimers();
    });

    it('should call both bucket RPCs with day bucket for 7d preset', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));

      const rpcMock = vi.fn(() => Promise.resolve({ data: [], error: null }));
      mockSupabaseClient.rpc = rpcMock;

      await service.getPageViewTimeSeries(TEST_TENANT_ID, '7d');

      const expected = {
        p_tenant_id: TEST_TENANT_ID,
        p_start: '2024-06-08T12:00:00.000Z',
        p_end: '2024-06-15T12:00:00.000Z',
        p_bucket: 'day'
      };
      expect(rpcMock).toHaveBeenCalledWith('analytics_page_view_buckets', expected);
      expect(rpcMock).toHaveBeenCalledWith('analytics_approval_buckets', expected);

      vi.useRealTimers();
    });

    it('should zero-fill missing buckets and merge RPC counts', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T03:15:00.000Z'));

      mockSupabaseClient.rpc = vi.fn((name: string) => {
        if (name === 'analytics_page_view_buckets') {
          return Promise.resolve({
            data: [
              { bucket_start: '2024-06-15T01:00:00.000Z', event_count: 5 },
              { bucket_start: '2024-06-15T02:00:00.000Z', event_count: 3 }
            ],
            error: null
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const series = await service.getPageViewTimeSeries(TEST_TENANT_ID, '12h');

      expect(series.length).toBeGreaterThan(0);
      const byHour = Object.fromEntries(series.map((p) => [p.bucketStart, p]));
      expect(byHour['2024-06-15T01:00:00.000Z'].count).toBe(5);
      expect(byHour['2024-06-15T02:00:00.000Z'].count).toBe(3);
      expect(byHour['2024-06-14T15:00:00.000Z'].count).toBe(0);
      expect(byHour['2024-06-15T01:00:00.000Z'].approvalCount).toBe(0);

      vi.useRealTimers();
    });

    it('should merge approval buckets by bucket_start', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T03:15:00.000Z'));

      mockSupabaseClient.rpc = vi.fn((name: string) => {
        if (name === 'analytics_page_view_buckets') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({
          data: [
            {
              bucket_start: '2024-06-15T01:00:00.000Z',
              approval_count: 2,
              approval_labels: 'Prayer A\nPrayer B (update)'
            }
          ],
          error: null
        });
      });

      const series = await service.getPageViewTimeSeries(TEST_TENANT_ID, '12h');
      const row = series.find((p) => p.bucketStart === '2024-06-15T01:00:00.000Z');
      expect(row?.approvalCount).toBe(2);
      expect(row?.approvalLabels).toBe('Prayer A\nPrayer B (update)');

      vi.useRealTimers();
    });

    it('should return zero-filled series when RPC errors', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T18:00:00.000Z'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSupabaseClient.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: { message: 'rpc failed' } })
      );

      const series = await service.getPageViewTimeSeries(TEST_TENANT_ID, '24h');

      expect(series.length).toBe(24);
      expect(series.every((p) => p.count === 0 && p.approvalCount === 0)).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
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
        if (table === 'tenant_memberships') {
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
        if (table === 'tenant_memberships') {
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
