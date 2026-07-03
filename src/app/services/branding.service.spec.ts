import { BehaviorSubject, Subject } from 'rxjs';
import { BrandingService, BrandingData } from './branding.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from '../utils/branding-cache-keys';

const TENANT_ID = 'tenant-branding-1';

const mockTenant = { id: TENANT_ID, name: 'Test Church', slug: 'test-church' };

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
  });

  describe('applySavedBranding', () => {
    it('should update cache and observable immediately', () => {
      const branding: BrandingData = {
        useLogo: true,
        lightLogo: 'light',
        darkLogo: 'dark',
        appTitle: 'Saved Church',
        appSubtitle: 'Saved tagline',
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
        appSubtitle: 'Subtitle',
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
