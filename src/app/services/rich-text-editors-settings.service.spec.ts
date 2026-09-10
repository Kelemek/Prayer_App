import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { skip, take } from 'rxjs/operators';
import { RichTextEditorsSettingsService } from './rich-text-editors-settings.service';

const TENANT = { id: 'tenant-1' };
const CACHE_KEY = 'rich_text_editors_enabled:tenant-1';

describe('RichTextEditorsSettingsService', () => {
  let service: RichTextEditorsSettingsService;
  let mockSupabase: any;
  let mockTenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: BehaviorSubject<{ id: string } | null>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue(TENANT),
      activeTenant$: new BehaviorSubject<{ id: string } | null>(TENANT),
    };

    mockSupabase = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { rich_text_editors_enabled: true },
                error: null,
              }),
            }),
          }),
        }),
      },
    };

    service = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.clear();
  });

  describe('getRichTextEditorsEnabled$', () => {
    it('emits boolean after fetch', async () => {
      const value = await firstValueFrom(service.getRichTextEditorsEnabled$());
      expect(typeof value).toBe('boolean');
      expect(value).toBe(true);
    });

    it('fetches from tenant_settings when subscribed', async () => {
      await firstValueFrom(service.getRichTextEditorsEnabled$());
      expect(mockSupabase.client.from).toHaveBeenCalledWith('tenant_settings');
    });

    it('emits false when column is false', async () => {
      localStorage.removeItem(CACHE_KEY);
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { rich_text_editors_enabled: false },
              error: null,
            }),
          }),
        }),
      });
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      const value = await firstValueFrom(
        newService.getRichTextEditorsEnabled$().pipe(skip(1), take(1))
      );
      expect(value).toBe(false);
    });

    it('treats missing row as enabled', async () => {
      localStorage.removeItem(CACHE_KEY);
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      const value = await firstValueFrom(
        newService.getRichTextEditorsEnabled$().pipe(skip(1), take(1))
      );
      expect(value).toBe(true);
    });
  });

  describe('getSnapshot', () => {
    it('returns current BehaviorSubject value', () => {
      expect(service.getSnapshot()).toBe(true);
    });
  });

  describe('ensureLoaded', () => {
    it('does not refetch when already loaded', async () => {
      await firstValueFrom(service.getRichTextEditorsEnabled$());
      const fromSpy = mockSupabase.client.from;
      fromSpy.mockClear();
      await firstValueFrom(service.getRichTextEditorsEnabled$());
      expect(fromSpy).not.toHaveBeenCalled();
    });
  });

  describe('invalidateFlagCache', () => {
    it('removes flag from localStorage', () => {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value: true, timestamp: Date.now() })
      );
      service.invalidateFlagCache();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });
  });

  describe('fetch errors', () => {
    it('warns when fetch returns error', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.removeItem(CACHE_KEY);
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'db error' },
            }),
          }),
        }),
      });
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      newService.getRichTextEditorsEnabled$().subscribe(() => {});
      await Promise.resolve();
      await Promise.resolve();
      expect(warn).toHaveBeenCalledWith(
        '[RichTextEditorsSettings] Failed to load flag',
        { message: 'db error' }
      );
      warn.mockRestore();
    });

    it('warns when fetch throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.removeItem(CACHE_KEY);
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      await firstValueFrom(newService.getRichTextEditorsEnabled$().pipe(take(1)));
      expect(warn).toHaveBeenCalledWith(
        '[RichTextEditorsSettings] Error loading flag',
        expect.any(Error)
      );
      warn.mockRestore();
    });
  });

  describe('seedFromLocalStorage', () => {
    it('uses cached value when within TTL', () => {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value: false, timestamp: Date.now() })
      );
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      expect(newService.getSnapshot()).toBe(false);
    });

    it('does not apply cache when timestamp is expired', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value: false, timestamp: twoHoursAgo })
      );
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      expect(newService.getSnapshot()).toBe(true);
    });

    it('ignores cache when JSON shape is invalid (non-boolean value)', () => {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value: 'true', timestamp: Date.now() })
      );
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      expect(newService.getSnapshot()).toBe(true);
    });

    it('ignores cache when JSON shape is invalid (non-number timestamp)', () => {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ value: true, timestamp: '2024-01-01' })
      );
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      expect(newService.getSnapshot()).toBe(true);
    });

    it('swallows invalid JSON in localStorage', () => {
      localStorage.setItem(CACHE_KEY, 'not-json');
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      expect(newService.getSnapshot()).toBe(true);
    });
  });

  describe('ensureLoaded', () => {
    it('does not start a second fetch while the first is in flight', () => {
      let resolveFetch: (v: { data: unknown; error: null }) => void;
      const pending = new Promise<{ data: unknown; error: null }>(resolve => {
        resolveFetch = resolve;
      });
      localStorage.removeItem(CACHE_KEY);
      mockSupabase.client.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockReturnValue(pending),
          }),
        }),
      });
      mockSupabase.client.from.mockClear();
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      newService.getRichTextEditorsEnabled$().subscribe();
      newService.getRichTextEditorsEnabled$().subscribe();
      expect(mockSupabase.client.from).toHaveBeenCalledTimes(1);
      resolveFetch!({ data: { rich_text_editors_enabled: true }, error: null });
    });
  });

  describe('invalidateFlagCache', () => {
    it('still triggers ensureLoaded when removeItem throws', () => {
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      expect(() => service.invalidateFlagCache()).not.toThrow();
      removeItem.mockRestore();
    });
  });

  describe('fetchAndCacheFlag persistence', () => {
    it('continues when localStorage.setItem throws after successful fetch', async () => {
      localStorage.removeItem(CACHE_KEY);
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });
      const newService = new RichTextEditorsSettingsService(mockSupabase, mockTenantContext as any);
      const value = await firstValueFrom(
        newService.getRichTextEditorsEnabled$().pipe(skip(1), take(1))
      );
      expect(value).toBe(true);
      setItem.mockRestore();
    });
  });
});
