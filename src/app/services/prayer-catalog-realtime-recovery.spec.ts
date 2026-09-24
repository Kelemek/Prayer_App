import { describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { PrayerService } from './prayer.service';
import { PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS } from '../lib/prayer-service-constants';

const TENANT = { id: 'test-tenant-id', name: 'Test', slug: 'test' };
const SHARED_CACHE_KEY = `tenant_${TENANT.id}_prayers`;

function cachedPrayer() {
  return {
    id: 'cached-1',
    title: 'Cached',
    description: 'Still on screen',
    status: 'current' as const,
    requester: 'Ada',
    prayer_for: 'World',
    email: null,
    is_anonymous: false,
    type: 'prayer' as const,
    date_requested: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updates: [],
  };
}

function queryBuilder(data: unknown[] = []) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder['select'] = chain;
  builder['eq'] = chain;
  builder['order'] = chain;
  builder['ilike'] = chain;
  builder['then'] = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

describe('prayer catalog realtime recovery', () => {
  function createHarness() {
    let onPrayers: ((payload: unknown) => void) | undefined;
    let onUpdates: ((payload: unknown) => void) | undefined;
    let onStatus: ((status: string) => void) | undefined;
    const channelApi = {
      on: vi.fn((
        _event: string,
        filter: { table?: string },
        cb: (payload: unknown) => void
      ) => {
        if (filter?.table === 'prayers') {
          onPrayers = cb;
        }
        if (filter?.table === 'prayer_updates') {
          onUpdates = cb;
        }
        return channelApi;
      }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        onStatus = cb;
        return channelApi;
      }),
    };
    const client = {
      from: vi.fn(() => queryBuilder([])),
      channel: vi.fn(() => channelApi),
      removeChannel: vi.fn().mockResolvedValue('ok'),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { email: 'user@example.com' } } },
        }),
      },
    };
    let onClientReplaced: ((previous: typeof client) => void) | undefined;
    const supabase = {
      client,
      isNetworkError: vi.fn(() => false),
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      onClientReplaced: (listener: (previous: typeof client) => void) => {
        onClientReplaced = listener;
        return () => {
          onClientReplaced = undefined;
        };
      },
    };
    const cache = {
      get: vi.fn(() => null),
      getStale: vi.fn(() => null),
      set: vi.fn(),
      invalidate: vi.fn(),
    };
    const loadingSubject = new BehaviorSubject(true);
    const service = new PrayerService(
      supabase as never,
      { success: vi.fn(), error: vi.fn(), info: vi.fn() } as never,
      { sendAdminNotification: vi.fn() } as never,
      {} as never,
      cache as never,
      { refreshBadgeCounts: vi.fn() } as never,
      {
        userSession$: new BehaviorSubject(null).asObservable(),
        getUserEmail: vi.fn(() => 'user@example.com'),
      } as never,
      {
        getActiveTenant: () => TENANT,
        getIsSuperAdmin: () => false,
        getIsImpersonatingTenant: () => false,
        activeTenant$: new BehaviorSubject(TENANT),
        loading$: loadingSubject.asObservable(),
      } as never,
      {
        isOnline: vi.fn(() => true),
        isOnline$: new BehaviorSubject(true).asObservable(),
        requireOnline: vi.fn(() => true),
      } as never
    );

    return {
      service,
      supabase,
      client,
      cache,
      channelApi,
      get onPrayers() {
        return onPrayers;
      },
      get onUpdates() {
        return onUpdates;
      },
      get onStatus() {
        return onStatus;
      },
      replaceClient() {
        onClientReplaced?.(client);
      },
    };
  }

  it('keeps a generic silent refresh on the warm cache', async () => {
    const { service, client, cache } = createHarness();
    cache.get.mockImplementation((key: string) =>
      key === SHARED_CACHE_KEY ? [cachedPrayer()] : null
    );
    client.from.mockClear();

    await service.loadPrayers(true);

    expect(client.from).not.toHaveBeenCalled();
  });

  it('reloads community prayers from the database when realtime bypasses the warm cache', async () => {
    const { service, client, cache, onPrayers, onUpdates } = createHarness();
    cache.get.mockImplementation((key: string) =>
      key === SHARED_CACHE_KEY ? [cachedPrayer()] : null
    );
    client.from.mockClear();

    await service.loadPrayers(true, { bypassWarmCache: true });
    expect(client.from).toHaveBeenCalledWith('prayers');

    client.from.mockClear();
    onPrayers?.({
      eventType: 'UPDATE',
      old: { id: 'cached-1', status: 'current' },
      new: { id: 'cached-1', status: 'answered' },
    });
    onUpdates?.({
      eventType: 'INSERT',
      old: {},
      new: { id: 'u1', prayer_id: 'cached-1' },
    });
    await Promise.resolve();

    expect(client.from).toHaveBeenCalledWith('prayers');
  });

  it('nulls the channel on CLOSED and subscribes again', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { service, client, onStatus } = createHarness();
    expect((service as unknown as { realtimeChannel: unknown }).realtimeChannel).toBeTruthy();

    onStatus?.('CLOSED');
    await Promise.resolve();

    expect((service as unknown as { realtimeChannel: unknown }).realtimeChannel).toBeNull();
    expect(client.removeChannel).toHaveBeenCalled();

    const callsBefore = client.channel.mock.calls.length;
    await vi.advanceTimersByTimeAsync(PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS);

    expect(client.channel.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('drops the orphaned channel and resubscribes after the supabase client is replaced', async () => {
    vi.useFakeTimers();
    const { service, client, replaceClient } = createHarness();
    const callsBefore = client.channel.mock.calls.length;

    replaceClient();
    expect((service as unknown as { realtimeChannel: unknown }).realtimeChannel).toBeNull();
    expect(client.removeChannel).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS);

    expect(client.channel.mock.calls.length).toBeGreaterThan(callsBefore);
    vi.useRealTimers();
  });
});
