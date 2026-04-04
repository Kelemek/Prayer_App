import { Injectable } from '@angular/core';
import type { TenantMembershipRole } from '../types/tenant';
import { TenantContextService } from './tenant-context.service';

@Injectable({
  providedIn: 'root'
})
export class TenantPermissionService {
  constructor(private tenantContext: TenantContextService) {}

  canAccessShared(): boolean {
    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant) return false;
    return tenant.plan_tier === 'groups' || tenant.plan_tier === 'churches';
  }

  canAccessAdmin(): boolean {
    if (this.tenantContext.getIsSuperAdmin()) {
      return true;
    }

    const tenant = this.tenantContext.getActiveTenant();
    if (!tenant || tenant.plan_tier !== 'churches') {
      return false;
    }

    return this.getActiveRole() === 'tenant_admin';
  }

  canAccessPresentation(): boolean {
    return this.canAccessShared();
  }

  canManageTenant(): boolean {
    return this.tenantContext.getIsSuperAdmin() || this.getActiveRole() === 'tenant_admin';
  }

  isPersonalOnlyUser(): boolean {
    return !this.canAccessShared();
  }

  private getActiveRole(): TenantMembershipRole | null {
    const activeTenant = this.tenantContext.getActiveTenant();
    if (!activeTenant) return null;
    const membership = this.tenantContext.getMemberships().find((m) => m.tenant_id === activeTenant.id);
    return membership?.role || null;
  }
}
