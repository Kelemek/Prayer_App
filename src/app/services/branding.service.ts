import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom, takeUntil } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay, take } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';
import {
  BRANDING_CACHE_KEYS,
  getBrandingCacheKey,
} from '../utils/branding-cache-keys';

export interface BrandingData {
  useLogo: boolean;
  lightLogo: string | null;
  darkLogo: string | null;
  appTitle: string;
  lastModified: Date | null;
}

@Injectable()
export class BrandingService implements OnDestroy {
  private brandingSubject = new BehaviorSubject<BrandingData>(this.getDefaultBranding());
  private isDarkMode = false;
  private darkModeObserver: MutationObserver | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private loadBrandingInFlight: Promise<void> | null = null;
  /** Last tenant whose branding was loaded; used to force DB refresh on switch. */
  private loadedBrandingTenantId: string | null = null;
  private readonly destroy$ = new Subject<void>();

  public branding$ = this.brandingSubject.asObservable().pipe(shareReplay(1));

  constructor(
    private supabaseService: SupabaseService,
    private tenantContext: TenantContextService
  ) {
    this.detectDarkMode();
    this.watchThemeChanges();

    this.tenantContext.activeTenant$
      .pipe(
        map((t) => t?.id ?? null),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        void this.loadBranding();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.darkModeObserver) {
      this.darkModeObserver.disconnect();
    }
  }

  private getBrandingCacheKey(base: string): string {
    return getBrandingCacheKey(base, this.tenantContext.getActiveTenant()?.id);
  }

  /**
   * Load branding after tenant context is ready. Bootstrap starts this
   * without awaiting; print awaits a snapshot. Views subscribe to branding$.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      await firstValueFrom(
        this.tenantContext.membershipPending$.pipe(
          filter((pending) => !pending),
          take(1)
        )
      );
      await this.loadBranding();
      this.initialized = true;
      const branding = this.brandingSubject.value;
      console.log('[BrandingService] Initialization complete:', {
        tenantId: this.tenantContext.getActiveTenant()?.id ?? null,
        useLogo: branding.useLogo,
        hasLightLogo: !!branding.lightLogo,
        hasDarkLogo: !!branding.darkLogo,
        appTitle: branding.appTitle,
        lastModified: branding.lastModified?.toISOString()
      });
    })();

    return this.initializationPromise;
  }

  /**
   * Apply branding saved in admin without re-fetching large logo blobs.
   */
  applySavedBranding(branding: BrandingData): void {
    const updated: BrandingData = {
      ...branding,
      lastModified: branding.lastModified ?? new Date(),
    };
    this.persistBrandingToCache(updated);
    this.brandingSubject.next(updated);
  }

  /**
   * Force reload from Supabase after admin saves tenant branding.
   */
  async refreshBranding(): Promise<void> {
    localStorage.removeItem(
      this.getBrandingCacheKey(BRANDING_CACHE_KEYS.lastModified)
    );
    await this.loadBranding();
  }

  /**
   * Get the current branding data
   */
  getBranding(): BrandingData {
    return this.brandingSubject.value;
  }

  /**
   * Get image URL based on current dark mode
   */
  getImageUrl(branding: BrandingData): string {
    if (!branding.useLogo) return '';
    return this.isDarkMode ? branding.darkLogo || '' : branding.lightLogo || '';
  }

  private async loadBranding(): Promise<void> {
    if (this.loadBrandingInFlight) {
      return this.loadBrandingInFlight;
    }
    this.loadBrandingInFlight = this.loadBrandingBody();
    try {
      await this.loadBrandingInFlight;
    } finally {
      this.loadBrandingInFlight = null;
    }
  }

  private async loadBrandingBody(): Promise<void> {
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    const tenantSwitched =
      this.loadedBrandingTenantId !== null &&
      tenantId !== this.loadedBrandingTenantId;

    try {
      const cached = this.loadFromCache();
      console.log('[BrandingService] Loaded from cache:', {
        tenantId,
        tenantSwitched,
        useLogo: cached.useLogo,
        hasLightLogo: !!cached.lightLogo,
        hasDarkLogo: !!cached.darkLogo
      });
      this.brandingSubject.next(cached);
      this.syncWindowLogoCache(cached);

      if (!tenantId) {
        this.loadedBrandingTenantId = null;
        console.log('[BrandingService] No active tenant; using cached/default branding');
        return;
      }

      if (tenantSwitched) {
        console.log('[BrandingService] Tenant switched, fetching branding from Supabase');
        await this.fetchFromSupabase(tenantId);
      } else {
        const row = await this.fetchPublicBrandingRowIfNewer(
          tenantId,
          cached.lastModified
        );
        if (row) {
          console.log(
            '[BrandingService] Branding changed, applying tenant settings from Supabase'
          );
          this.applyBrandingRow(row, tenantId);
        } else {
          console.log('[BrandingService] Using cached branding (no tenant updates)');
        }
      }

      if (this.tenantContext.getActiveTenant()?.id === tenantId) {
        this.loadedBrandingTenantId = tenantId;
      }
    } catch (error) {
      console.warn('[BrandingService] Failed to load branding:', error);
    }
  }

  /**
   * Load branding from window cache and localStorage (tenant-scoped when active).
   */
  private loadFromCache(): BrandingData {
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    const windowCache = (window as {
      __cachedLogos?: {
        light?: string | null;
        dark?: string | null;
        useLogo?: boolean;
        tenantId?: string | null;
      };
    }).__cachedLogos;
    const windowCacheApplies =
      !!windowCache &&
      (!tenantId || !windowCache.tenantId || windowCache.tenantId === tenantId);

    const lightKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.lightLogo);
    const darkKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.darkLogo);
    const useKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.useLogo);
    const titleKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.appTitle);
    const modifiedKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.lastModified);

    const lightStored = localStorage.getItem(lightKey);
    const darkStored = localStorage.getItem(darkKey);
    const useStored = localStorage.getItem(useKey);
    const lightLogo =
      lightStored ?? (windowCacheApplies ? windowCache?.light ?? null : null);
    const darkLogo =
      darkStored ?? (windowCacheApplies ? windowCache?.dark ?? null : null);
    const useLogo =
      useStored !== null
        ? useStored === 'true'
        : windowCacheApplies && windowCache?.useLogo === true;
    const appTitle = localStorage.getItem(titleKey) ?? 'Church Prayer Manager';
    const lastModifiedStr = localStorage.getItem(modifiedKey);

    return {
      useLogo,
      lightLogo,
      darkLogo,
      appTitle,
      lastModified: lastModifiedStr ? new Date(lastModifiedStr) : null
    };
  }

  private syncWindowLogoCache(branding: BrandingData): void {
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    (window as {
      __cachedLogos?: {
        light?: string | null;
        dark?: string | null;
        useLogo?: boolean;
        tenantId?: string | null;
      };
    }).__cachedLogos = {
      tenantId,
      light: branding.lightLogo,
      dark: branding.darkLogo,
      useLogo: branding.useLogo,
    };
  }

  private persistBrandingToCache(branding: BrandingData): void {
    const useKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.useLogo);
    const lightKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.lightLogo);
    const darkKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.darkLogo);
    const titleKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.appTitle);
    const modifiedKey = this.getBrandingCacheKey(BRANDING_CACHE_KEYS.lastModified);

    if (branding.useLogo !== null && branding.useLogo !== undefined) {
      localStorage.setItem(useKey, String(branding.useLogo));
    }
    if (branding.lightLogo) {
      localStorage.setItem(lightKey, branding.lightLogo);
    }
    if (branding.darkLogo) {
      localStorage.setItem(darkKey, branding.darkLogo);
    }
    if (branding.appTitle) {
      localStorage.setItem(titleKey, branding.appTitle);
    }
    if (branding.lastModified) {
      localStorage.setItem(modifiedKey, branding.lastModified.toISOString());
    }
    this.syncWindowLogoCache(branding);
  }

  /**
   * One public-branding RPC. Returns the row when it is newer than the cache
   * (or the cache has no timestamp) so the caller can apply it without a second download.
   * An unchanged timestamp returns null and leaves cached logos in place.
   */
  private async fetchPublicBrandingRowIfNewer(
    tenantId: string,
    cachedLastModified: Date | null
  ): Promise<Record<string, unknown> | null> {
    try {
      const activeId = this.tenantContext.getActiveTenant()?.id;
      if (!activeId || activeId !== tenantId) {
        return null;
      }

      const row = await this.rpcPublicBranding(tenantId);
      if (!row) {
        return null;
      }

      const lastModifiedStr = row['branding_last_modified'] as string | null;
      if (!lastModifiedStr) {
        return null;
      }

      const dbLastModified = new Date(lastModifiedStr);
      if (!cachedLastModified || dbLastModified > cachedLastModified) {
        return row;
      }
      return null;
    } catch (error) {
      console.warn('[BrandingService] Failed to check metadata:', error);
      return null;
    }
  }

  private async rpcPublicBranding(
    tenantId: string
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabaseService.client.rpc(
      'get_public_tenant_branding',
      { p_tenant_id: tenantId }
    );

    if (error || !data) {
      return null;
    }

    const row = (data as Array<Record<string, unknown>>)[0];
    return row ?? null;
  }

  private mapBrandingRow(settings: Record<string, unknown>): BrandingData {
    return {
      useLogo: (settings['use_logo'] as boolean | null) ?? false,
      lightLogo: (settings['light_mode_logo_blob'] as string | null) || null,
      darkLogo: (settings['dark_mode_logo_blob'] as string | null) || null,
      appTitle: (settings['app_title'] as string | null) || 'Church Prayer Manager',
      lastModified: settings['branding_last_modified']
        ? new Date(settings['branding_last_modified'] as string)
        : null
    };
  }

  private applyBrandingRow(settings: Record<string, unknown>, forTenantId: string): void {
    const branding = this.mapBrandingRow(settings);
    this.persistBrandingToCache(branding);
    if (this.tenantContext.getActiveTenant()?.id === forTenantId) {
      this.brandingSubject.next(branding);
    }
  }

  private async fetchFromSupabase(forTenantId: string): Promise<void> {
    try {
      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId || tenantId !== forTenantId) {
        return;
      }

      const settings = await this.rpcPublicBranding(tenantId);
      if (!settings) {
        return;
      }

      this.applyBrandingRow(settings, forTenantId);
    } catch (error) {
      console.warn('[BrandingService] Failed to fetch branding from Supabase:', error);
    }
  }

  private getDefaultBranding(): BrandingData {
    return {
      useLogo: false,
      lightLogo: null,
      darkLogo: null,
      appTitle: 'Church Prayer Manager',
      lastModified: null
    };
  }

  private detectDarkMode(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  private watchThemeChanges(): void {
    this.darkModeObserver = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark !== this.isDarkMode) {
        this.isDarkMode = isDark;
        this.brandingSubject.next(this.brandingSubject.value);
      }
    });

    this.darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
}
