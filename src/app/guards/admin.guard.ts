import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { map, skipWhile, timeout, catchError } from 'rxjs/operators';
import { AdminAuthService } from '../services/admin-auth.service';
import { TenantContextService } from '../services/tenant-context.service';
import { TenantPermissionService } from '../services/tenant-permission.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const adminAuthService = inject(AdminAuthService);
  const tenantContextService = inject(TenantContextService);
  const tenantPermissions = inject(TenantPermissionService);
  const router = inject(Router);

  // Wait for loading to complete, then check admin status in active tenant
  return combineLatest([
    adminAuthService.loading$,
    tenantContextService.loading$
  ]).pipe(
    skipWhile(([authLoading, tenantLoading]) => authLoading || tenantLoading),
    // Fail-fast if loading never resolves
    timeout(5000),
    map(() => {
      if (!tenantPermissions.canAccessAdmin()) {
        // Preserve the original URL in returnUrl so user returns after login
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }
      return true;
    }),
    catchError(err => {
      console.error('[adminGuard] timeout or error waiting for admin state:', err);
      // On timeout or error, navigate to login with returnUrl
      return of(router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url }
      }));
    })
  );
};
