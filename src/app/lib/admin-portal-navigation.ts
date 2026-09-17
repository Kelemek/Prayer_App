import type { Router } from "@angular/router";
import type { ConnectivityService } from "../services/connectivity.service";
import type { TenantContextService } from "../services/tenant-context.service";
import type { TenantPermissionService } from "../services/tenant-permission.service";
import type { ToastService } from "../services/toast.service";

export interface AdminPortalNavigationDeps {
  connectivity: ConnectivityService;
  tenantPermissionService: TenantPermissionService;
  tenantContext: TenantContextService;
  router: Router;
  toastService: ToastService;
}

export function navigateToAdminPortal(deps: AdminPortalNavigationDeps): void {
  if (!deps.connectivity.requireOnline("open the admin portal")) {
    return;
  }
  const memberships = deps.tenantContext.getMemberships();
  if (
    !deps.tenantPermissionService.canAccessAdmin() &&
    memberships.length > 0
  ) {
    deps.toastService.error("Admin access is not available for this account");
    return;
  }
  void deps.router.navigate(["/admin"]);
}
