import {
  Component,
  OnInit,
  Injector,
  NgZone,
  ChangeDetectionStrategy,
} from "@angular/core";
import { Router, RouterOutlet, NavigationEnd } from "@angular/router";
import { CommonModule } from "@angular/common";
import { Capacitor } from "@capacitor/core";
import { AnalyticsConsentBannerComponent } from "./components/analytics-consent-banner/analytics-consent-banner.component";
import { ToastContainerComponent } from "./components/toast-container/toast-container.component";
import { TenantSwitcherBarComponent } from "./components/tenant-switcher-bar/tenant-switcher-bar.component";
import { supportPageUrl } from "./constants/app-defaults";
import { AdminAuthService } from "./services/admin-auth.service";
import { AdminDataService } from "./services/admin-data.service";
import { PosthogService } from "./services/posthog.service";
import { filter, firstValueFrom, take } from "rxjs";

/** Survives login redirect when the approval `code` is dropped from the URL. */
const PENDING_ACCOUNT_APPROVAL_CODE_KEY = "prayerapp_pending_account_approval_code";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    TenantSwitcherBarComponent,
    AnalyticsConsentBannerComponent,
  ],
  template: `
    <ng-container>
      <div
        class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      >
        <app-tenant-switcher-bar />
        <router-outlet></router-outlet>
        <app-toast-container></app-toast-container>
        <app-analytics-consent-banner />
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class AppShellComponent implements OnInit {
  title = "prayerapp";
  private accountApprovalProcessing = false;
  /** Avoid repeating the unsigned-admin toast on every NavigationEnd. */
  private accountApprovalPromptedForLoginCode: string | null = null;

  constructor(
    private router: Router,
    private injector: Injector,
    private ngZone: NgZone,
    _posthog: PosthogService
  ) {
    // Add native-app class immediately so bottom blur strip shows before first paint
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add("native-app");
    }
    // Set up global error handler for unhandled errors
    this.setupGlobalErrorHandler();
    // Listen for navigation events and scroll to top on mobile
    this.setupScrollToTopOnNavigation();
    // Initialize Capacitor for mobile apps
    this.initializeCapacitor();
  }

  /**
   * Initialize Capacitor service for mobile app features.
   * Also inject PushNotificationService (device tokens) and AppIconBadgeService
   * (native icon badge = all-tenant in-app prayer count).
   */
  private async initializeCapacitor(): Promise<void> {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        document.documentElement.classList.add("native-app");
      }
      const { CapacitorService } = await import("./services/capacitor.service");
      const { PushNotificationService } = await import(
        "./services/push-notification.service"
      );
      const { AppIconBadgeService } = await import(
        "./services/app-icon-badge.service"
      );
      this.injector.get(CapacitorService);
      this.injector.get(PushNotificationService);
      this.injector.get(AppIconBadgeService);
    } catch (error) {
      console.debug("Capacitor service not available (running on web)", error);
    }
  }

  /**
   * Setup router navigation listener to scroll to top
   * Critical for mobile (iOS/Edge) where scroll position can get stuck
   */
  private setupScrollToTopOnNavigation(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          // Also try setting document scroll for older browsers
          if (document.documentElement) {
            document.documentElement.scrollTop = 0;
          }
          if (document.body) {
            document.body.scrollTop = 0;
          }
        }, 0);
      });
  }

  /**
   * Set up a global error handler to catch uncaught errors and prevent blank pages
   */
  private setupGlobalErrorHandler(): void {
    // Catch unhandled promise rejections
    this.ngZone.run(() => {
      window.addEventListener("unhandledrejection", (event) => {
        console.error(
          "[GlobalErrorHandler] Unhandled promise rejection:",
          event.reason
        );
        // Don't auto-reload - let the app handle recovery gracefully
      });

      // Catch global errors
      window.addEventListener("error", (event) => {
        console.error("[GlobalErrorHandler] Global error:", event.error);
        // Don't auto-reload - let the app handle recovery gracefully
      });
    });
  }

  ngOnInit() {
    this.handleApprovalCode();
    this.setupAccountApprovalOnNavigation();
    this.setupPushRefreshListener();
  }

  private isAccountApprovalCode(code: string): boolean {
    return (
      code.startsWith("account_approve_") || code.startsWith("account_deny_")
    );
  }

  private readAccountApprovalCode(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("code");
    if (fromUrl && this.isAccountApprovalCode(fromUrl)) {
      return fromUrl;
    }
    try {
      const stored = sessionStorage.getItem(PENDING_ACCOUNT_APPROVAL_CODE_KEY);
      if (stored && this.isAccountApprovalCode(stored)) {
        return stored;
      }
    } catch {
      // sessionStorage may be unavailable in some embedded contexts
    }
    return null;
  }

  private clearPendingAccountApprovalCode(): void {
    try {
      sessionStorage.removeItem(PENDING_ACCOUNT_APPROVAL_CODE_KEY);
    } catch {
      // ignore
    }
  }

  /** Stop re-processing the same email link on every navigation. */
  private dismissAccountApprovalLink(): void {
    this.accountApprovalPromptedForLoginCode = null;
    this.clearPendingAccountApprovalCode();
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("code");
      if (!fromUrl || !this.isAccountApprovalCode(fromUrl)) {
        return;
      }
      params.delete("code");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    } catch {
      // ignore
    }
  }

  /**
   * Account approval links only. Other `code` values belong to Supabase PKCE
   * (`detectSessionInUrl`) and must be left on the URL.
   */
  private async handleApprovalCode() {
    const code = this.readAccountApprovalCode();
    if (!code || this.accountApprovalProcessing) return;
    await this.handleAccountApprovalCode(code);
  }

  private setupAccountApprovalOnNavigation(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        void this.handleApprovalCode();
      });
  }

  /**
   * Unsigned email links are not credentials. Wait out auth bootstrap, then
   * require an authenticated admin session before any read or membership write.
   */
  private async currentSessionIsAdmin(): Promise<boolean> {
    const adminAuth = this.injector.get(AdminAuthService);
    if (adminAuth.isLoading()) {
      await firstValueFrom(
        adminAuth.loading$.pipe(
          filter((loading) => !loading),
          take(1)
        )
      );
    }
    return adminAuth.getIsAdmin() && adminAuth.getUser() != null;
  }

  private async handleAccountApprovalCode(code: string) {
    if (this.accountApprovalProcessing) return;
    this.accountApprovalProcessing = true;
    try {
      const { ToastService } = await import("./services/toast.service");
      const toast = this.injector.get(ToastService);

      if (!(await this.currentSessionIsAdmin())) {
        try {
          sessionStorage.setItem(PENDING_ACCOUNT_APPROVAL_CODE_KEY, code);
        } catch {
          // ignore
        }
        const alreadyPrompted =
          this.accountApprovalPromptedForLoginCode === code;
        if (!alreadyPrompted) {
          this.accountApprovalPromptedForLoginCode = code;
          toast.showToast(
            "Sign in as a church admin to use this approval link",
            "error"
          );
          const returnUrl = `${window.location.pathname}${window.location.search}`;
          if (!this.router.url.startsWith("/login")) {
            await this.router.navigate(["/login"], {
              queryParams: { returnUrl },
            });
          }
        }
        return;
      }

      this.accountApprovalPromptedForLoginCode = null;

      // Lazy load required services
      const { ApprovalLinksService } = await import(
        "./services/approval-links.service"
      );
      const { SupabaseService } = await import("./services/supabase.service");
      const { EmailNotificationService } = await import(
        "./services/email-notification.service"
      );

      const approvalLinks = this.injector.get(ApprovalLinksService);
      const supabase = this.injector.get(SupabaseService);
      const emailService = this.injector.get(EmailNotificationService);

      // Decode the code to get email and action type
      const decoded = approvalLinks.decodeAccountCode(code);

      if (!decoded) {
        console.error("Invalid account approval code format");
        this.dismissAccountApprovalLink();
        toast.showToast("Invalid approval link", "error");
        this.router.navigate(["/login"]);
        return;
      }

      // Use the signed-in client so RLS sees the admin session.
      // directQuery/directMutation send the publishable key (tracked separately).
      const { data: requests, error: fetchError } = await supabase.client
        .from("account_approval_requests")
        .select("id, email, first_name, last_name, approval_status, tenant_id")
        .eq("email", decoded.email.toLowerCase())
        .limit(1);

      if (
        fetchError ||
        !requests ||
        !Array.isArray(requests) ||
        requests.length === 0
      ) {
        console.error("Account approval request not found:", fetchError);
        this.dismissAccountApprovalLink();
        toast.showToast("Approval request not found", "error");
        this.router.navigate(["/login"]);
        return;
      }

      const request = requests[0];

      if (request.approval_status !== "pending") {
        this.dismissAccountApprovalLink();
        toast.showToast(
          `This request has already been ${request.approval_status}`,
          "info"
        );
        this.router.navigate(["/login"]);
        return;
      }

      if (decoded.type === "approve") {
        // Approve the account - add to tenant_memberships
        const approvalTenantId = request.tenant_id;
        if (!approvalTenantId) {
          console.error("Approval request missing tenant_id");
          this.dismissAccountApprovalLink();
          toast.showToast(
            "Cannot approve: missing organization on request",
            "error"
          );
          this.router.navigate(["/login"]);
          return;
        }

        const { error: insertError } = await supabase.client
          .from("tenant_memberships")
          .insert({
            user_email: request.email.toLowerCase(),
            name: `${request.first_name} ${request.last_name}`,
            is_active: true,
            role: "member",
            receive_admin_emails: false,
            tenant_id: approvalTenantId,
          });

        if (insertError) {
          console.error("Failed to create subscriber:", insertError);
          this.dismissAccountApprovalLink();
          toast.showToast("Failed to approve account", "error");
          this.router.navigate(["/login"]);
          return;
        }

        await supabase.client
          .from("account_approval_requests")
          .delete()
          .eq("id", request.id);

        // Send approval email to user
        try {
          const template = await emailService.getTemplate(
            "account_approved",
            approvalTenantId
          );
          if (template) {
            const subject = emailService.applyTemplateVariables(
              template.subject,
              {
                firstName: request.first_name,
              }
            );
            const html = emailService.applyTemplateVariables(
              template.html_body,
              {
                firstName: request.first_name,
                lastName: request.last_name,
                email: request.email,
                loginLink: `${emailService.getEmailBaseUrl()}/login`,
              }
            );
            const text = emailService.applyTemplateVariables(
              template.text_body,
              {
                firstName: request.first_name,
                lastName: request.last_name,
                email: request.email,
                loginLink: `${emailService.getEmailBaseUrl()}/login`,
              }
            );

            await emailService.sendEmail({
              to: request.email,
              subject,
              htmlBody: html,
              textBody: text,
              tenantId: request.tenant_id,
            });
          }
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
        }

        toast.showToast(
          `Account approved for ${request.first_name} ${request.last_name}`,
          "success"
        );
      } else {
        await supabase.client
          .from("account_approval_requests")
          .delete()
          .eq("id", request.id);

        // Send denial email to user
        try {
          const template = await emailService.getTemplate(
            "account_denied",
            request.tenant_id
          );
          if (template) {
            const subject = emailService.applyTemplateVariables(
              template.subject,
              {
                firstName: request.first_name,
              }
            );
            const html = emailService.applyTemplateVariables(
              template.html_body,
              {
                firstName: request.first_name,
                lastName: request.last_name,
                supportEmail: supportPageUrl(emailService.getEmailBaseUrl()),
              }
            );
            const text = emailService.applyTemplateVariables(
              template.text_body,
              {
                firstName: request.first_name,
                lastName: request.last_name,
                supportEmail: supportPageUrl(emailService.getEmailBaseUrl()),
              }
            );

            await emailService.sendEmail({
              to: request.email,
              subject,
              htmlBody: html,
              textBody: text,
              tenantId: request.tenant_id,
            });
          }
        } catch (emailError) {
          console.error("Failed to send denial email:", emailError);
        }

        toast.showToast(
          `Account denied for ${request.first_name} ${request.last_name}`,
          "info"
        );
      }

      this.dismissAccountApprovalLink();
      this.router.navigate(["/login"]);
    } catch (error) {
      console.error("Error handling account approval code:", error);
      this.dismissAccountApprovalLink();
      try {
        const { ToastService } = await import("./services/toast.service");
        const toast = this.injector.get(ToastService) as {
          showToast?: (msg: string, type: string) => void;
        };
        if (toast && typeof toast.showToast === "function") {
          toast.showToast("Failed to process approval", "error");
        }
      } catch (toastError) {
        console.error("Failed to show approval error toast:", toastError);
      }
      this.router.navigate(["/login"]);
    } finally {
      this.accountApprovalProcessing = false;
    }
  }

  /**
   * Subscribe to native push notification events and refresh prayers when relevant.
   * This only has effect in the Capacitor (native) app where push notifications are active.
   */
  private async setupPushRefreshListener(): Promise<void> {
    try {
      const { CapacitorService } = await import("./services/capacitor.service");
      const { PrayerService } = await import("./services/prayer.service");

      const capacitorService = this.injector.get(CapacitorService);
      const prayerService = this.injector.get(PrayerService);

      capacitorService.notificationEvents$
        .pipe(
          filter((event) => event.source === "tap"),
          filter(
            (event) =>
              event.type === "prayer_update" ||
              event.type === "prayer_approved" ||
              event.type === "update_approved"
          )
        )
        .subscribe((event) => {
          console.log(
            "[AppComponent] Push notification tapped, refreshing prayers:",
            event
          );
          prayerService.loadPrayers(false).catch((err) => {
            console.error(
              "[AppComponent] Failed to refresh prayers after push:",
              err
            );
          });
        });

      // Navigate to admin when an admin push notification is tapped
      capacitorService.notificationEvents$
        .pipe(
          filter((event) => event.source === "tap"),
          filter((event) => event.data?.["target"] === "admin")
        )
        .subscribe(() => {
          // Pre-fetch admin data so the approval list is ready when the page loads.
          // Run in NgZone so change detection runs when the app was resumed from background.
          const adminDataService = this.injector.get(AdminDataService);
          adminDataService.fetchAdminData(false, true).catch((err) => {
            console.error(
              "[AppComponent] Failed to pre-fetch admin data after push tap:",
              err
            );
          });
          this.ngZone.run(() => {
            this.router.navigate(["/admin"]);
          });
        });

      capacitorService.notificationEvents$
        .pipe(
          filter((event) => event.source === "tap"),
          filter((event) => event.type === "memorization_reminder")
        )
        .subscribe(() => {
          this.ngZone.run(() => {
            void this.router.navigate(["/"], {
              queryParams: { filter: "memorize" },
            });
          });
        });
    } catch (error) {
      // Likely running on web where Capacitor/PrayerService lazy imports may not be needed
      console.debug(
        "[AppComponent] Push refresh listener not initialized (probably web):",
        error
      );
    }
  }

}
