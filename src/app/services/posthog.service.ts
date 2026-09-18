import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsentValue,
} from '../../lib/analytics-consent';
import { resolveAnalyticsGeoRegion } from '../../lib/analytics-geo';
import type { AnalyticsGeoRegion } from '../../lib/analytics-geo-region';
import {
  applyAnalyticsConsent,
  applyPostHogAppContext,
  applyPostHogTenantGroup,
  capturePostHogPageview,
  identifyPostHogUser,
  initializePostHog,
  isAnalyticsCaptureAllowed,
  isPostHogConfigured,
  posthog,
  resetPostHogUser,
} from '../../lib/posthog';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

@Injectable({ providedIn: 'root' })
export class PosthogService {
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly supabase = inject(SupabaseService);
  private readonly tenantContext = inject(TenantContextService);

  private lastUserId: string | null = null;

  readonly analyticsConsent = signal<AnalyticsConsentValue | null>(
    getAnalyticsConsent()
  );

  /** `null` while geo is resolving (banner must not flash). */
  readonly analyticsRegion = signal<AnalyticsGeoRegion | null>(null);

  readonly posthogConfigured = isPostHogConfigured();

  constructor() {
    this.ngZone.runOutsideAngular(() => {
      void this.bootstrapPostHog();
    });
    this.setupPageviewCapture();
    this.setupTenantContextSync();
    this.setupAuthIdentitySync();
  }

  private async bootstrapPostHog(): Promise<void> {
    if (!this.posthogConfigured) {
      return;
    }
    const geo = await resolveAnalyticsGeoRegion();
    this.analyticsRegion.set(geo.region);
    initializePostHog(geo.region);
    capturePostHogPageview(this.router.url);
  }

  private isTenantAndIdentitySyncAllowed(): boolean {
    return isAnalyticsCaptureAllowed();
  }

  setUserAnalyticsConsent(consent: AnalyticsConsentValue): void {
    setAnalyticsConsent(consent);
    this.analyticsConsent.set(consent);
    this.ngZone.runOutsideAngular(() => {
      applyAnalyticsConsent(consent);
      if (consent === 'accepted') {
        if (this.lastUserId) {
          identifyPostHogUser(this.lastUserId);
        }
        const tenant = this.tenantContext.getActiveTenant();
        const tenantProps = tenant
          ? { id: tenant.id, slug: tenant.slug, name: tenant.name }
          : null;
        applyPostHogAppContext(posthog, tenantProps);
        applyPostHogTenantGroup(posthog, tenantProps);
        capturePostHogPageview(this.router.url);
      }
    });
  }

  private setupPageviewCapture(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.ngZone.runOutsideAngular(() => {
          capturePostHogPageview(event.urlAfterRedirects);
        });
      });
  }

  private setupTenantContextSync(): void {
    this.tenantContext.activeTenant$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tenant) => {
        if (!this.isTenantAndIdentitySyncAllowed()) {
          return;
        }
        this.ngZone.runOutsideAngular(() => {
          const tenantProps = tenant
            ? { id: tenant.id, slug: tenant.slug, name: tenant.name }
            : null;
          applyPostHogAppContext(posthog, tenantProps);
          applyPostHogTenantGroup(posthog, tenantProps);
        });
      });
  }

  private setupAuthIdentitySync(): void {
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.ngZone.runOutsideAngular(() => {
        const userId = session?.user?.id;
        this.lastUserId = userId ?? null;
        if (userId) {
          identifyPostHogUser(userId);
          if (!this.isTenantAndIdentitySyncAllowed()) {
            return;
          }
          const tenant = this.tenantContext.getActiveTenant();
          if (tenant) {
            applyPostHogAppContext(posthog, {
              id: tenant.id,
              slug: tenant.slug,
            });
            applyPostHogTenantGroup(posthog, tenant);
          }
        } else {
          resetPostHogUser();
        }
      });
    });
  }
}
