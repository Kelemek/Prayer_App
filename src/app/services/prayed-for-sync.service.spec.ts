import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PrayedForSyncService } from './prayed-for-sync.service';

describe('PrayedForSyncService', () => {
  let service: PrayedForSyncService;
  let supabase: { client: { rpc: ReturnType<typeof vi.fn> } };
  let connectivity: {
    isOnline: ReturnType<typeof vi.fn>;
    isOnline$: BehaviorSubject<boolean>;
  };
  let userSession: {
    getUserEmail: ReturnType<typeof vi.fn>;
    userSession$: BehaviorSubject<{ email: string } | null>;
  };
  let tenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: BehaviorSubject<{ id: string } | null>;
  };

  const storageKey = 'prayed_for_pending:v2:tenant-1:user@example.com';

  beforeEach(() => {
    localStorage.clear();
    supabase = {
      client: {
        rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
      },
    };
    connectivity = {
      isOnline: vi.fn(() => true),
      isOnline$: new BehaviorSubject(true),
    };
    userSession = {
      getUserEmail: vi.fn(() => 'user@example.com'),
      userSession$: new BehaviorSubject<{ email: string } | null>({
        email: 'user@example.com',
      }),
    };
    tenantContext = {
      getActiveTenant: vi.fn(() => ({ id: 'tenant-1' })),
      activeTenant$: new BehaviorSubject<{ id: string } | null>({
        id: 'tenant-1',
      }),
    };

    service = new PrayedForSyncService(
      supabase as any,
      connectivity as any,
      userSession as any,
      tenantContext as any
    );
  });

  afterEach(() => {
    localStorage.clear();
    service.ngOnDestroy();
  });

  it('enqueue and displayCount track pending items', () => {
    expect(service.enqueue('community_prayer', 'p1')).toBe(true);
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(1);
    expect(service.displayCount(4, 'p1', 'community_prayer')).toBe(5);
  });

  it('returns false from enqueue without tenant and email', () => {
    userSession.getUserEmail.mockReturnValue(null);
    tenantContext.getActiveTenant.mockReturnValue(null);
    expect(service.enqueue('community_prayer', 'p1')).toBe(false);
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
  });

  it('persists queue to localStorage scoped by tenant and email', () => {
    service.enqueue('prompt', 'prompt-1');
    expect(localStorage.getItem(storageKey)).toContain('prompt-1');
  });

  it('flush processes queue and emits synced event', async () => {
    supabase.client.rpc.mockResolvedValue({ data: 9, error: null });
    service.enqueue('community_prayer', 'p1');

    const syncedPromise = firstValueFrom(service.synced$);
    await service.flush();

    expect(supabase.client.rpc).toHaveBeenCalledWith(
      'increment_prayed_for_count',
      { prayer_id: 'p1' }
    );
    const synced = await syncedPromise;
    expect(synced).toEqual({
      kind: 'community_prayer',
      itemId: 'p1',
      serverCount: 9,
    });
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
  });

  it('flush leaves queue intact when offline', async () => {
    connectivity.isOnline.mockReturnValue(false);
    service.enqueue('community_prayer', 'p1');

    await service.flush();

    expect(supabase.client.rpc).not.toHaveBeenCalled();
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(1);
  });

  it('drops queue head after max failed flush attempts', async () => {
    supabase.client.rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    service.enqueue('community_prayer', 'p1');

    for (let i = 0; i < 5; i++) {
      await service.flush();
    }

    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
    expect(localStorage.getItem(storageKey)).toBe('[]');
  });

  it('flushes and clears storage on logout using previous session email', async () => {
    service.enqueue('community_prayer', 'p1');
    supabase.client.rpc.mockResolvedValue({ data: 3, error: null });

    userSession.getUserEmail.mockReturnValue(null);
    userSession.userSession$.next(null);

    await vi.waitFor(() => {
      expect(localStorage.getItem(storageKey)).toBeNull();
    });

    expect(supabase.client.rpc).toHaveBeenCalled();
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
  });
});
