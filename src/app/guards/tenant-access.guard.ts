import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantAccessService } from '../services/tenant-access.service';
import { TenantContextService } from '../services/tenant-context.service';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

export const tenantAccessGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const tenantAccess = inject(TenantAccessService);
  const tenantContext = inject(TenantContextService);

  const isSuperAdmin = await firstValueFrom(
    tenantContext.isSuperAdmin$.pipe(take(1)),
  );
  if (isSuperAdmin) {
    return true;
  }

  const target = await tenantAccess.resolveTargetTenant(null);
  if (!target) {
    return true;
  }

  try {
    const access = await tenantAccess.getState(target.id);
    if (access.state === 'member') {
      return true;
    }
  } catch {
    return router.createUrlTree(['/request-access'], {
      queryParams: { returnUrl: state.url },
    });
  }

  return router.createUrlTree(['/request-access'], {
    queryParams: { returnUrl: state.url },
  });
};
