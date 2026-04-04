import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, map, skipWhile, timeout } from 'rxjs/operators';
import { AdminAuthService } from '../services/admin-auth.service';
import { TenantContextService } from '../services/tenant-context.service';
import { TenantPermissionService } from '../services/tenant-permission.service';

export const sharedAccessGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const adminAuth = inject(AdminAuthService);
  const tenantContext = inject(TenantContextService);
  const permissionService = inject(TenantPermissionService);

  return combineLatest([adminAuth.loading$, tenantContext.loading$]).pipe(
    skipWhile(([authLoading, tenantLoading]) => authLoading || tenantLoading),
    timeout(5000),
    map(() => {
      if (!permissionService.canAccessShared()) {
        return router.createUrlTree(['/'], { queryParams: { denied: 'shared', returnUrl: state.url } });
      }
      return true;
    }),
    catchError((error) => {
      console.error('[sharedAccessGuard] Failed to resolve access:', error);
      return of(router.createUrlTree(['/']));
    })
  );
};
