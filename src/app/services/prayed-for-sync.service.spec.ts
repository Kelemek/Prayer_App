import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
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
  let tenantContext: { getActiveTenant: ReturnType<typeof vi.fn>; activeTenant$: BehaviorSubject<{ id: string } | null> };
  let injector: { get: ReturnType<typeof vi.fn> };

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
      activeTenant$: new BehaviorSubject<{ id: string } | null>({ id: 'tenant-1' }),
    };
    injector = { get: vi.fn() };

    service = new PrayedForSyncService(
      supabase as any,
      connectivity as any,
      userSession as any,
      tenantContext as any,
      injector as any
    );
  });

  afterEach(() => {
    localStorage.clear();
    service.ngOnDestroy();
  });

  it('enqueue and mergeServerCount track pending items', () => {
    service.enqueue('community_prayer', 'p1');
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(1);
    expect(service.mergeServerCount('p1', 'community_prayer', 4)).toBe(5);
  });

  it('persists queue to localStorage scoped by tenant and email', () => {
    service.enqueue('prompt', 'prompt-1');
    expect(
      localStorage.getItem('prayed_for_pending:v1:tenant-1:user@example.com')
    ).toContain('prompt-1');
  });

  it('flush processes queue and applies server count', async () => {
    const prayerService = {
      applyCommunityPrayedForCount: vi.fn(),
    };
    injector.get.mockReturnValue(prayerService);

    supabase.client.rpc.mockResolvedValue({ data: 9, error: null });
    service.enqueue('community_prayer', 'p1');

    await service.flush();

    expect(supabase.client.rpc).toHaveBeenCalledWith('increment_prayed_for_count', {
      prayer_id: 'p1',
    });
    expect(prayerService.applyCommunityPrayedForCount).toHaveBeenCalledWith('p1', 9);
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
  });

  it('flush leaves queue intact when offline', async () => {
    connectivity.isOnline.mockReturnValue(false);
    service.enqueue('community_prayer', 'p1');

    await service.flush();

    expect(supabase.client.rpc).not.toHaveBeenCalled();
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(1);
  });

  it('clearQueue removes persisted entries', () => {
    service.enqueue('community_prayer', 'p1');
    service.clearQueue();
    expect(service.getPendingCount('p1', 'community_prayer')).toBe(0);
    expect(
      localStorage.getItem('prayed_for_pending:v1:tenant-1:user@example.com')
    ).toBeNull();
  });
});
