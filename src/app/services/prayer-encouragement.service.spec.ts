import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { skip, take } from 'rxjs/operators';
import { PrayerEncouragementService } from './prayer-encouragement.service';
import { SupabaseService } from './supabase.service';

describe('PrayerEncouragementService', () => {
  let service: PrayerEncouragementService;
  let mockSupabase: any;
  const mockTenantContext = {
    getActiveTenant: vi.fn().mockReturnValue(null),
    activeTenant$: new BehaviorSubject(null)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockTenantContext.getActiveTenant.mockReturnValue(null);

    mockSupabase = {
      client: {
        rpc: vi.fn().mockResolvedValue({
          data: [{ prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 4 }],
          error: null,
        }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 4 },
                error: null
              })
            })
          })
        })
      }
    };

    service = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.clear();
  });

  describe('getCooldownKey', () => {
    it('returns key with prefix and prayer id', () => {
      expect(service.getCooldownKey('abc-123')).toBe('prayed_for_abc-123');
    });
  });

  describe('canPrayFor', () => {
    it('returns true when no key in localStorage', () => {
      expect(service.canPrayFor('p1')).toBe(true);
    });

    it('returns false when key exists and is within 4h', () => {
      service.recordPrayedFor('p1');
      expect(service.canPrayFor('p1')).toBe(false);
    });

    it('returns true and removes key when cooldown expired', () => {
      const over4hAgo = new Date(Date.now() - (5 * 60 * 60 * 1000)).toISOString();
      localStorage.setItem('prayed_for_p1', over4hAgo);
      expect(service.canPrayFor('p1')).toBe(true);
      expect(localStorage.getItem('prayed_for_p1')).toBeNull();
    });

    it('returns true and removes key when value is invalid', () => {
      localStorage.setItem('prayed_for_p1', 'not-a-date');
      expect(service.canPrayFor('p1')).toBe(true);
      expect(localStorage.getItem('prayed_for_p1')).toBeNull();
    });

    it('returns true when localStorage throws', () => {
      const originalGetItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      expect(service.canPrayFor('p1')).toBe(true);
      localStorage.getItem = originalGetItem;
    });
  });

  describe('recordPrayedFor', () => {
    it('sets localStorage key with ISO timestamp', () => {
      service.recordPrayedFor('p2');
      const raw = localStorage.getItem('prayed_for_p2');
      expect(raw).toBeTruthy();
      expect(new Date(raw!).getTime()).toBeLessThanOrEqual(Date.now());
      expect(service.canPrayFor('p2')).toBe(false);
    });

    it('catches when localStorage.setItem throws and does not throw', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Quota exceeded');
      });
      service.recordPrayedFor('p3');
      expect(localStorage.getItem('prayed_for_p3')).toBeNull();
      localStorage.setItem = originalSetItem;
    });
  });

  describe('clearCooldownKeys', () => {
    it('removes all prayed_for_ keys from localStorage', () => {
      service.recordPrayedFor('a');
      service.recordPrayedFor('b');
      localStorage.setItem('other_key', 'value');
      service.clearCooldownKeys();
      expect(localStorage.getItem('prayed_for_a')).toBeNull();
      expect(localStorage.getItem('prayed_for_b')).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('value');
    });

    it('does nothing when no prayed_for_ keys exist', () => {
      localStorage.setItem('other', 'x');
      service.clearCooldownKeys();
      expect(localStorage.getItem('other')).toBe('x');
    });
  });

  describe('getPrayerEncouragementEnabled$', () => {
    it('returns observable that emits after fetch', async () => {
      const value = await firstValueFrom(service.getPrayerEncouragementEnabled$());
      expect(typeof value).toBe('boolean');
    });

    it('fetches from admin_settings when no active tenant', async () => {
      await firstValueFrom(service.getPrayerEncouragementEnabled$());
      expect(mockSupabase.client.from).toHaveBeenCalledWith('admin_settings');
    });

    it('fetches from public tenant RPC when active tenant is set', async () => {
      mockTenantContext.getActiveTenant.mockReturnValue({ id: 'tenant-1' });
      const tenantService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      await firstValueFrom(tenantService.getPrayerEncouragementEnabled$());
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith(
        'get_public_tenant_prayer_encouragement',
        { p_tenant_id: 'tenant-1' }
      );
      tenantService.ngOnDestroy();
      mockTenantContext.getActiveTenant.mockReturnValue(null);
    });
  });

  describe('getCooldownHours$', () => {
    it('emits cooldown hours from fetch (default 4 when not in response)', async () => {
      const hours = await firstValueFrom(service.getCooldownHours$());
      expect(hours).toBe(4);
    });

    it('emits cooldown hours from fetch when set in response', async () => {
      localStorage.clear();
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 8 },
              error: null
            })
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      await firstValueFrom(newService.getCooldownHours$());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await firstValueFrom(newService.getCooldownHours$())).toBe(8);
      newService.ngOnDestroy();
    });
  });

  describe('fetchAndCacheFlag', () => {
    it('uses DEFAULT_COOLDOWN_HOURS when rawHours is out of range', async () => {
      localStorage.removeItem('prayer_encouragement_enabled');
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 0 },
              error: null
            })
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      const hours = await firstValueFrom(newService.getCooldownHours$().pipe(skip(1), take(1)));
      expect(hours).toBe(4);
    });

    it('uses DEFAULT_COOLDOWN_HOURS when rawHours is above 168', async () => {
      localStorage.removeItem('prayer_encouragement_enabled');
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 200 },
              error: null
            })
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      const hours = await firstValueFrom(newService.getCooldownHours$().pipe(skip(1), take(1)));
      expect(hours).toBe(4);
    });

    it('warns and returns when fetch returns error', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.clear();
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'db error' }
            })
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      await firstValueFrom(newService.getCooldownHours$());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warn).toHaveBeenCalledWith('[PrayerEncouragement] Failed to load flag', { message: 'db error' });
      warn.mockRestore();
      newService.ngOnDestroy();
    });

    it('warns when fetch throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.clear();
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      await firstValueFrom(newService.getCooldownHours$());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warn).toHaveBeenCalledWith('[PrayerEncouragement] Error loading flag', expect.any(Error));
      warn.mockRestore();
      newService.ngOnDestroy();
    });

    it('continues when localStorage.setItem in fetch throws', async () => {
      localStorage.removeItem('prayer_encouragement_enabled');
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { prayer_encouragement_enabled: true, prayer_encouragement_cooldown_hours: 4 },
              error: null
            })
          })
        })
      });
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      const hours = await firstValueFrom(newService.getCooldownHours$().pipe(skip(1), take(1)));
      expect(hours).toBe(4);
      setItem.mockRestore();
    });
  });

  describe('seedFromLocalStorage', () => {
    it('uses DEFAULT_COOLDOWN_HOURS when cached cooldownHours is out of range', () => {
      localStorage.setItem(
        'prayer_encouragement_enabled',
        JSON.stringify({ value: true, cooldownHours: 0, timestamp: Date.now() })
      );
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      const hours = firstValueFrom(newService.getCooldownHours$());
      return hours.then((h) => expect(h).toBe(4));
    });

    it('does not update subjects when cache timestamp is expired', () => {
      const oneHourAgo = Date.now() - (2 * 60 * 60 * 1000);
      localStorage.setItem(
        'prayer_encouragement_enabled',
        JSON.stringify({ value: true, cooldownHours: 6, timestamp: oneHourAgo })
      );
      const newService = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      return firstValueFrom(newService.getCooldownHours$().pipe(skip(1), take(1))).then((h) => {
        expect(h).toBe(4);
      });
    });
  });

  describe('ensureLoaded', () => {
    it('does not refetch when already loaded', async () => {
      await firstValueFrom(service.getPrayerEncouragementEnabled$());
      const fromSpy = mockSupabase.client.from;
      fromSpy.mockClear();
      await firstValueFrom(service.getPrayerEncouragementEnabled$());
      expect(fromSpy).not.toHaveBeenCalled();
    });
  });

  describe('invalidateFlagCache', () => {
    it('clears cached flag and reloads from server', async () => {
      const removeSpy = vi.spyOn(localStorage, 'removeItem');
      localStorage.setItem(
        'prayer_encouragement_enabled',
        JSON.stringify({ value: false, cooldownHours: 4, timestamp: Date.now() })
      );
      service.invalidateFlagCache();
      expect(removeSpy).toHaveBeenCalledWith('prayer_encouragement_enabled');
      await firstValueFrom(service.getPrayerEncouragementEnabled$());
      expect(localStorage.getItem('prayer_encouragement_enabled')).toContain('"value":true');
      removeSpy.mockRestore();
    });
  });

  describe('cleanExpiredCooldownKeys on init', () => {
    it('removes expired prayed_for_ keys when service is constructed', () => {
      const over4hAgo = new Date(Date.now() - (5 * 60 * 60 * 1000)).toISOString();
      localStorage.setItem('prayed_for_old', over4hAgo);
      const s2 = new PrayerEncouragementService(mockSupabase, mockTenantContext as any);
      expect(localStorage.getItem('prayed_for_old')).toBeNull();
    });
  });
});
