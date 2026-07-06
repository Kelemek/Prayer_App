import { BehaviorSubject, Subject } from 'rxjs';
import { BrandingService, BrandingData } from './branding.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from '../utils/branding-cache-keys';

const TENANT_ID = 'tenant-branding-1';
const TENANT_ID_B = 'tenant-branding-2';

const mockTenant = { id: TENANT_ID, name: 'Test Church', slug: 'test-church' };
const mockTenantB = { id: TENANT_ID_B, name: 'Other Church', slug: 'other-church' };

function tenantKey(base: string): string {
  return getBrandingCacheKey(base, TENANT_ID);
}

describe('BrandingService', () => {
  let service: BrandingService;
  let rpcMock: ReturnType<typeof vi.fn>;
  let mockSupabaseService: { client: { rpc: ReturnType<typeof vi.fn> } };
  let mockTenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    activeTenant$: Subject<typeof mockTenant | null>;
    loading$: BehaviorSubject<boolean>;
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();

    rpcMock = vi.fn();
    mockSupabaseService = {
      client: { rpc: rpcMock }
    };

    mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue(mockTenant),
      activeTenant$: new Subject<typeof mockTenant | null>(),
      loading$: new BehaviorSubject(false)
    };

    service = new BrandingService(
      mockSupabaseService as any,
      mockTenantContext as any
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    if ((service as any).darkModeObserver) {
      (service as any).darkModeObserver.disconnect();
    }
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should load tenant-scoped cached data on initialize', async () => {
      const cachedTimestamp = new Date('2024-01-01').toISOString();
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.useLogo), 'true');
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.appTitle), 'Test Church');
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.lastModified), cachedTimestamp);

      rpcMock.mockResolvedValue({
        data: [{ branding_last_modified: cachedTimestamp }],
        error: null
      });

      await service.initialize();

      expect(service.getBranding().appTitle).toBe('Test Church');
      expect(rpcMock).toHaveBeenCalledWith('get_public_tenant_branding', {
        p_tenant_id: TENANT_ID
      });
    });

    it('should skip Supabase when no active tenant', async () => {
      mockTenantContext.getActiveTenant.mockReturnValue(null);
      localStorage.setItem(BRANDING_CACHE_KEYS.appTitle, 'Legacy Title');

      await service.initialize();

      expect(rpcMock).not.toHaveBeenCalled();
      expect(service.getBranding().appTitle).toBe('Legacy Title');
    });

    it('should not use window cache from a different tenant', async () => {
      const otherTenantLogo = 'data:image/webp;base64,other-tenant';
      (window as { __cachedLogos?: unknown }).__cachedLogos = {
        tenantId: 'other-tenant',
        light: otherTenantLogo,
        useLogo: true,
      };

      await service.initialize();

      expect(service.getBranding().lightLogo).toBeNull();
      expect(service.getBranding().useLogo).toBe(false);
    });

    it('should use tenant cache without refetch when branding is unchanged', async () => {
      const cachedTimestamp = new Date('2024-06-01').toISOString();
      const cachedLogo = 'data:image/webp;base64,cached-logo';
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.useLogo), 'true');
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.lightLogo), cachedLogo);
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.lastModified), cachedTimestamp);

      rpcMock.mockResolvedValue({
        data: [{ branding_last_modified: cachedTimestamp }],
        error: null,
      });

      await service.initialize();

      expect(service.getBranding().lightLogo).toBe(cachedLogo);
      expect(rpcMock).toHaveBeenCalledTimes(1);
    });

    it('should refetch from Supabase when the active tenant switches', async () => {
      const cachedTimestamp = new Date('2024-06-01').toISOString();
      const tenantALogo = 'data:image/webp;base64,tenant-a';
      const tenantBLogo = 'data:image/webp;base64,tenant-b';

      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.useLogo), 'true');
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.lightLogo), tenantALogo);
      localStorage.setItem(tenantKey(BRANDING_CACHE_KEYS.lastModified), cachedTimestamp);

      const tenantBKey = getBrandingCacheKey(BRANDING_CACHE_KEYS.lightLogo, TENANT_ID_B);
      localStorage.setItem(tenantBKey, tenantBLogo);
      localStorage.setItem(
        getBrandingCacheKey(BRANDING_CACHE_KEYS.useLogo, TENANT_ID_B),
        'true'
      );
      localStorage.setItem(
        getBrandingCacheKey(BRANDING_CACHE_KEYS.lastModified, TENANT_ID_B),
        cachedTimestamp
      );

      rpcMock
        .mockResolvedValueOnce({
          data: [{ branding_last_modified: cachedTimestamp }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              use_logo: true,
              light_mode_logo_blob: tenantBLogo,
              dark_mode_logo_blob: null,
              app_title: 'Other Church',
              branding_last_modified: cachedTimestamp,
            },
          ],
          error: null,
        });

      await service.initialize();
      expect(rpcMock).toHaveBeenCalledTimes(1);

      mockTenantContext.getActiveTenant.mockReturnValue(mockTenantB);
      mockTenantContext.activeTenant$.next(mockTenantB);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(rpcMock).toHaveBeenLastCalledWith('get_public_tenant_branding', {
        p_tenant_id: TENANT_ID_B,
      });
      expect(service.getBranding().lightLogo).toBe(tenantBLogo);
      expect(service.getBranding().appTitle).toBe('Other Church');
    });
  });

  describe('applySavedBranding', () => {
    it('should update cache and observable immediately', () => {
      const branding: BrandingData = {
        useLogo: true,
        lightLogo: 'light',
        darkLogo: 'dark',
        appTitle: 'Saved Church',
        lastModified: new Date('2024-06-01'),
      };

      service.applySavedBranding(branding);

      expect(service.getBranding().appTitle).toBe('Saved Church');
      expect(localStorage.getItem(tenantKey(BRANDING_CACHE_KEYS.appTitle))).toBe(
        'Saved Church'
      );
    });
  });

  describe('dark mode', () => {
    it('should return correct image URL based on dark mode', async () => {
      const branding: BrandingData = {
        useLogo: true,
        lightLogo: 'light-url',
        darkLogo: 'dark-url',
        appTitle: 'Title',
        lastModified: null
      };

      document.documentElement.classList.remove('dark');
      expect(service.getImageUrl(branding)).toBe('light-url');

      document.documentElement.classList.add('dark');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(service.getImageUrl(branding)).toBe('dark-url');

      document.documentElement.classList.remove('dark');
    });
  });
});
