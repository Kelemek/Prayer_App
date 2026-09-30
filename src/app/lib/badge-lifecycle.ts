import type { Injector } from '@angular/core';
import { distinctUntilChanged } from 'rxjs/operators';
import { APP_BECAME_VISIBLE_EVENT } from './app-foreground';
import { tenantBadgeMembershipCacheKey } from './in-app-prayer-badge-count';
import type { TenantInAppBadgeService } from '../services/tenant-in-app-badge.service';
import { UserSessionService } from '../services/user-session.service';
import { TenantContextService } from '../services/tenant-context.service';

export interface BadgeLifecycleHost {
  injector: Injector;
  tenantBadges: TenantInAppBadgeService;
  clearSessionBadgeState(): void;
  reloadReadStateFromSources(): void | Promise<void>;
  refreshReadStateOnForeground(): void | Promise<void>;
  ensureAllTenantInAppBadgeCaches(): void | Promise<void>;
  onScopedBadgeReadStorageKey(key: string): void;
  onGroupBadgeReadStorageKey(key: string): boolean;
  onMemberPrayerGroupIdsStorageKey(key: string): boolean;
  refreshBadgeCounts(): void;
}

/** Module-level guards: one listener set per SPA lifetime; tests call resetBadgeLifecycleListenersForTests(). */
let storageListenerAttached = false;
let visibilityListenerAttached = false;

export function attachBadgeServiceLifecycle(host: BadgeLifecycleHost): void {
  attachSessionTenantMembershipListeners(host);
  attachCrossTabStorageListener(host);
  attachForegroundListener(host);
}

function attachSessionTenantMembershipListeners(host: BadgeLifecycleHost): void {
  setTimeout(() => {
    try {
      const userSession = host.injector.get(UserSessionService);
      userSession.userSession$
        .pipe(
          distinctUntilChanged(
            (prev, curr) =>
              prev?.email === curr?.email &&
              prev?.badgeFunctionalityEnabled === curr?.badgeFunctionalityEnabled
          )
        )
        .subscribe((session) => {
          if (session) {
            host.tenantBadges.applyUserSession(session);
            void host.reloadReadStateFromSources();
          } else {
            host.clearSessionBadgeState();
          }
        });
    } catch {
      // ignore
    }

    try {
      const ctx = host.injector.get(TenantContextService);
      ctx.activeTenant$
        .pipe(distinctUntilChanged((a, b) => a?.id === b?.id))
        .subscribe(() => {
          void host.reloadReadStateFromSources();
        });

      const memberships$ = ctx.memberships$;
      if (memberships$) {
        memberships$
          .pipe(
            distinctUntilChanged((prev, next) =>
              tenantBadgeMembershipCacheKey(prev) ===
              tenantBadgeMembershipCacheKey(next)
            )
          )
          .subscribe(() => {
            void host.ensureAllTenantInAppBadgeCaches();
          });
      }
    } catch {
      // ignore
    }
  }, 0);
}

function attachCrossTabStorageListener(host: BadgeLifecycleHost): void {
  if (storageListenerAttached || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (!event.key) {
      return;
    }
    if (event.key.startsWith('badge_read:')) {
      host.onScopedBadgeReadStorageKey(event.key);
      return;
    }
    if (event.key.startsWith('badge_read_groups:')) {
      if (host.onGroupBadgeReadStorageKey(event.key)) {
        host.refreshBadgeCounts();
      }
      return;
    }
    if (
      event.key.startsWith('memberPrayerGroupIds:') &&
      host.onMemberPrayerGroupIdsStorageKey(event.key)
    ) {
      host.refreshBadgeCounts();
    }
  });

  storageListenerAttached = true;
}

function attachForegroundListener(host: BadgeLifecycleHost): void {
  if (visibilityListenerAttached || typeof document === 'undefined') {
    return;
  }

  window.addEventListener(APP_BECAME_VISIBLE_EVENT, () => {
    void host.refreshReadStateOnForeground();
  });

  visibilityListenerAttached = true;
}

/** Reset module-level guards between test files. */
export function resetBadgeLifecycleListenersForTests(): void {
  storageListenerAttached = false;
  visibilityListenerAttached = false;
}
