import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { ToastService } from "./toast.service";
import { UserSessionService } from "./user-session.service";
import { TenantPermissionService } from "./tenant-permission.service";
import { TenantContextService } from "./tenant-context.service";
import { ConnectivityService } from "./connectivity.service";
import { AdminDataService } from "./admin-data.service";
import { navigateToAdminPortal } from "../lib/admin-portal-navigation";

@Injectable()
export class HomeAdminNavigationController {
  constructor(
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly userSessionService: UserSessionService,
    private readonly tenantPermissionService: TenantPermissionService,
    private readonly tenantContextService: TenantContextService,
    private readonly connectivity: ConnectivityService,
    private readonly adminDataService: AdminDataService
  ) {}

  navigateToAdmin(): void {
    navigateToAdminPortal({
      connectivity: this.connectivity,
      tenantPermissionService: this.tenantPermissionService,
      tenantContext: this.tenantContextService,
      router: this.router,
      toastService: this.toastService,
      adminData: this.adminDataService,
    });
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
