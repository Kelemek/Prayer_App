import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  applyPostHogAppContext,
  applyPostHogTenantGroup,
  capturePostHogPageview,
  identifyPostHogUser,
  initializePostHog,
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

  constructor() {
    this.ngZone.runOutsideAngular(() => {
      initializePostHog();
      capturePostHogPageview(this.router.url);
    });
    this.setupPageviewCapture();
    this.setupTenantContextSync();
    this.setupAuthIdentitySync();
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
        if (userId) {
          identifyPostHogUser(userId);
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
