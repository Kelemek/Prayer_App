import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { TenantAccessService } from '../services/tenant-access.service';
import { TenantContextService } from '../services/tenant-context.service';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { markColdBoot } from '../lib/cold-boot-performance';

export const tenantAccessGuard: CanActivateFn = async (_route, state) => {
  const tenantAccess = inject(TenantAccessService);
  const tenantContext = inject(TenantContextService);

  try {
    const isSuperAdmin = await firstValueFrom(
      tenantContext.isSuperAdmin$.pipe(take(1))
    );
    if (isSuperAdmin) {
      return true;
    }
    return await tenantAccess.resolveSlugHostMemberAccess(state.url);
  } finally {
    markColdBoot('tenant-access-guard-ready');
  }
};
