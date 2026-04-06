import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

export interface BrandingData {
  useLogo: boolean;
  lightLogo: string | null;
  darkLogo: string | null;
  appTitle: string;
  appSubtitle: string;
  lastModified: Date | null;
}

@Injectable()
export class BrandingService implements OnDestroy {
  private readonly LIGHT_LOGO_KEY = 'branding_light_logo';
  private readonly DARK_LOGO_KEY = 'branding_dark_logo';
  private readonly USE_LOGO_KEY = 'branding_use_logo';
  private readonly APP_TITLE_KEY = 'branding_app_title';
  private readonly APP_SUBTITLE_KEY = 'branding_app_subtitle';
  private readonly LAST_MODIFIED_KEY = 'branding_last_modified';

  private brandingSubject = new BehaviorSubject<BrandingData>(this.getDefaultBranding());
  private isDarkMode = false;
  private darkModeObserver: MutationObserver | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private loadBrandingInFlight: Promise<void> | null = null;
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
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    return tenantId ? `${base}:${tenantId}` : base;
  }

  /**
   * Lazy-load branding data on first subscription
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.loadBranding();
    await this.initializationPromise;
    this.initialized = true;
    const branding = this.brandingSubject.value;
    console.log('[BrandingService] Initialization complete:', {
      useLogo: branding.useLogo,
      hasLightLogo: !!branding.lightLogo,
      hasDarkLogo: !!branding.darkLogo,
      appTitle: branding.appTitle,
      lastModified: branding.lastModified?.toISOString()
    });
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

  /**
   * Load cached branding from window, localStorage, then query Supabase for updates
   */
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
    try {
      const cached = this.loadFromCache();
      console.log('[BrandingService] Loaded from cache:', {
        useLogo: cached.useLogo,
        hasLightLogo: !!cached.lightLogo,
        hasDarkLogo: !!cached.darkLogo
      });
      this.brandingSubject.next(cached);

      const shouldFetch = await this.shouldFetchFromSupabase(cached.lastModified);

      if (shouldFetch) {
        console.log('[BrandingService] Logo data changed, fetching from Supabase');
        await this.fetchFromSupabase();
      } else {
        console.log('[BrandingService] Using cached logo data (no updates)');
      }
    } catch (error) {
      console.warn('[BrandingService] Failed to load branding:', error);
    }
  }

  /**
   * Load branding from window cache and localStorage
   * This is synchronous to prevent flash of text logo when image is cached
   */
  private loadFromCache(): BrandingData {
    const windowCache = (window as any).__cachedLogos;

    const lightKey = this.getBrandingCacheKey(this.LIGHT_LOGO_KEY);
    const darkKey = this.getBrandingCacheKey(this.DARK_LOGO_KEY);
    const useKey = this.getBrandingCacheKey(this.USE_LOGO_KEY);
    const titleKey = this.getBrandingCacheKey(this.APP_TITLE_KEY);
    const subtitleKey = this.getBrandingCacheKey(this.APP_SUBTITLE_KEY);
    const modifiedKey = this.getBrandingCacheKey(this.LAST_MODIFIED_KEY);

    const lightLogo = localStorage.getItem(lightKey) ?? windowCache?.light ?? null;
    const darkLogo = localStorage.getItem(darkKey) ?? windowCache?.dark ?? null;
    const useLogo = localStorage.getItem(useKey);
    const appTitle = localStorage.getItem(titleKey) ?? 'Church Prayer Manager';
    const appSubtitle = localStorage.getItem(subtitleKey) ?? 'Keeping our community connected in prayer';
    const lastModifiedStr = localStorage.getItem(modifiedKey);

    return {
      useLogo: (useLogo === 'true') || (windowCache?.useLogo === true),
      lightLogo,
      darkLogo,
      appTitle,
      appSubtitle,
      lastModified: lastModifiedStr ? new Date(lastModifiedStr) : null
    };
  }

  private persistBrandingToCache(branding: BrandingData): void {
    const useKey = this.getBrandingCacheKey(this.USE_LOGO_KEY);
    const lightKey = this.getBrandingCacheKey(this.LIGHT_LOGO_KEY);
    const darkKey = this.getBrandingCacheKey(this.DARK_LOGO_KEY);
    const titleKey = this.getBrandingCacheKey(this.APP_TITLE_KEY);
    const subtitleKey = this.getBrandingCacheKey(this.APP_SUBTITLE_KEY);
    const modifiedKey = this.getBrandingCacheKey(this.LAST_MODIFIED_KEY);

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
    if (branding.appSubtitle) {
      localStorage.setItem(subtitleKey, branding.appSubtitle);
    }
    if (branding.lastModified) {
      localStorage.setItem(modifiedKey, branding.lastModified.toISOString());
    }
  }

  /**
   * Check if we should fetch updated branding from Supabase
   */
  private async shouldFetchFromSupabase(cachedLastModified: Date | null): Promise<boolean> {
    try {
      const tenantId = this.tenantContext.getActiveTenant()?.id;

      if (tenantId) {
        const { data, error } = await this.supabaseService.client
          .from('tenant_settings')
          .select('branding_last_modified')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error || !data) {
          return false;
        }

        const lastModifiedStr = data.branding_last_modified as string | null;
        if (!lastModifiedStr) {
          return false;
        }

        const dbLastModified = new Date(lastModifiedStr);
        if (!cachedLastModified) {
          return true;
        }
        return dbLastModified > cachedLastModified;
      }

      const { data, error } = await this.supabaseService.directQuery<{
        branding_last_modified: string | null;
      }>('admin_settings', {
        select: 'branding_last_modified',
        eq: { id: 1 },
        limit: 1,
        timeout: 3000
      });

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return false;
      }

      const lastModifiedStr = data[0].branding_last_modified;
      if (!lastModifiedStr) {
        return false;
      }

      const dbLastModified = new Date(lastModifiedStr);
      if (!cachedLastModified) {
        return true;
      }
      return dbLastModified > cachedLastModified;
    } catch (error) {
      console.warn('[BrandingService] Failed to check metadata:', error);
      return false;
    }
  }

  /**
   * Fetch full branding data from Supabase and update cache
   */
  private async fetchFromSupabase(): Promise<void> {
    try {
      const tenantId = this.tenantContext.getActiveTenant()?.id;

      if (tenantId) {
        const { data, error } = await this.supabaseService.client
          .from('tenant_settings')
          .select(
            'use_logo, light_mode_logo_blob, dark_mode_logo_blob, app_title, app_subtitle, branding_last_modified'
          )
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error || !data) {
          return;
        }

        const branding: BrandingData = {
          useLogo: data.use_logo ?? false,
          lightLogo: data.light_mode_logo_blob || null,
          darkLogo: data.dark_mode_logo_blob || null,
          appTitle: data.app_title || 'Church Prayer Manager',
          appSubtitle: data.app_subtitle || 'Keeping our community connected in prayer',
          lastModified: data.branding_last_modified ? new Date(data.branding_last_modified as string) : null
        };

        this.persistBrandingToCache(branding);
        this.brandingSubject.next(branding);
        return;
      }

      const { data, error } = await this.supabaseService.directQuery<{
        use_logo: boolean;
        light_mode_logo_blob: string | null;
        dark_mode_logo_blob: string | null;
        app_title: string;
        app_subtitle: string;
        branding_last_modified: string | null;
      }>('admin_settings', {
        select: 'use_logo, light_mode_logo_blob, dark_mode_logo_blob, app_title, app_subtitle, branding_last_modified',
        eq: { id: 1 },
        limit: 1,
        timeout: 10000
      });

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return;
      }

      const settings = data[0];
      const branding: BrandingData = {
        useLogo: settings.use_logo ?? false,
        lightLogo: settings.light_mode_logo_blob || null,
        darkLogo: settings.dark_mode_logo_blob || null,
        appTitle: settings.app_title || 'Church Prayer Manager',
        appSubtitle: settings.app_subtitle || 'Keeping our community connected in prayer',
        lastModified: settings.branding_last_modified ? new Date(settings.branding_last_modified) : null
      };

      this.persistBrandingToCache(branding);
      this.brandingSubject.next(branding);
    } catch (error) {
      console.warn('[BrandingService] Failed to fetch branding from Supabase:', error);
    }
  }

  /**
   * Get default branding data
   */
  private getDefaultBranding(): BrandingData {
    return {
      useLogo: false,
      lightLogo: null,
      darkLogo: null,
      appTitle: 'Church Prayer Manager',
      appSubtitle: 'Keeping our community connected in prayer',
      lastModified: null
    };
  }

  /**
   * Detect current dark mode state
   */
  private detectDarkMode(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  /**
   * Watch for dark mode theme changes and update branding
   */
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
