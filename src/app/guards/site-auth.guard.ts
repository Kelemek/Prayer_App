import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';
import { combineLatest, of } from 'rxjs';
import { map, skipWhile } from 'rxjs/operators';

/**
 * Site-wide authentication guard
 * All users must be authenticated to view any page except the login page itself
 * Block checks now run in the background to avoid blank screens when the DB is cold
 */
export const siteAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const adminAuthService = inject(AdminAuthService);

  // Wait for loading to complete, then check authentication
  return combineLatest([
    adminAuthService.isAuthenticated$,
    adminAuthService.loading$
  ]).pipe(
    // Skip while loading
    skipWhile(([_, isLoading]) => isLoading),
    // Take first value after loading is complete
    map(([isAuthenticated]) => {
      // If not authenticated, redirect to login
      if (!isAuthenticated) {
        console.log('[SiteAuthGuard] Access denied - redirecting to login');
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      // Run blocked check in background so routing is instant; redirect later if needed
      adminAuthService.checkBlockedStatusInBackground(state.url);
      return true;
    })
  );
};
