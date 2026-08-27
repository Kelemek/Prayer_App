import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { ToastService } from "./toast.service";
import { UserSessionService } from "./user-session.service";
import { TenantPermissionService } from "./tenant-permission.service";
import { TenantContextService } from "./tenant-context.service";
import { ConnectivityService } from "./connectivity.service";

@Injectable()
export class HomeAdminNavigationController {
  constructor(
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly userSessionService: UserSessionService,
    private readonly tenantPermissionService: TenantPermissionService,
    private readonly tenantContextService: TenantContextService,
    private readonly connectivity: ConnectivityService
  ) {}

  navigateToAdmin(): void {
    if (!this.connectivity.requireOnline("open the admin portal")) {
      return;
    }
    const memberships = this.tenantContextService.getMemberships();
    if (
      !this.tenantPermissionService.canAccessAdmin() &&
      memberships.length > 0
    ) {
      this.toastService.error("Admin access is not available for this account");
      return;
    }
    this.router.navigate(["/admin"]);
  }

  getUserEmail(): string {
    const cachedEmail = this.userSessionService.getUserEmail();
    if (cachedEmail) return cachedEmail;

    const approvalEmail = localStorage.getItem("approvalAdminEmail");
    if (approvalEmail) return approvalEmail;

    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) return userEmail;

    const prayerappEmail = localStorage.getItem("prayerapp_user_email");
    if (prayerappEmail) return prayerappEmail;

    return "Not logged in";
  }
}
