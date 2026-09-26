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
import { AdminDataService } from "./services/admin-data.service";
import { PosthogService } from "./services/posthog.service";
import { filter } from "rxjs";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    AnalyticsConsentBannerComponent,
  ],
  template: `
    <ng-container>
      <div
        class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      >
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
    this.setupPushRefreshListener();
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
