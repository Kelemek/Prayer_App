import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { provideHttpClient, withXhr } from "@angular/common/http";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideServiceWorker } from "@angular/service-worker";
import { isDevMode } from "@angular/core";

import { IMAGE_CONFIG } from "@angular/common";
import { APP_INITIALIZER } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { AdminAuthService } from "./app/services/admin-auth.service";
import { BrandingService } from "./app/services/branding.service";
import { ClientVersionGateService } from "./app/services/client-version-gate.service";
import { BRANDING_SERVICE_TOKEN } from "./app/components/app-logo/app-logo.component";
import { providePostHogErrorHandler } from "./app/posthog-error-handler";
import { environment } from "./environments/environment";
import {
  CAPACITOR_LIVE_ORIGIN,
  maybeRedirectNativeToLiveSite,
} from "./lib/capacitor-live-boot";
import { maybeAutoReloadWebOnce } from "./lib/client-version-gate";

// Add a global visibility check to ensure content stays visible during background refresh
const setupVisibilityRecovery = () => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      console.log("[AppInitialization] Page became visible");

      // Verify router outlet exists
      const routerOutlet = document.querySelector("router-outlet");
      if (!routerOutlet) {
        console.warn(
          "[AppInitialization] Router outlet not found when page became visible"
        );
        // Don't reload - let services handle the refresh
      } else {
        console.log(
          "[AppInitialization] Page visible and router outlet intact"
        );
        // Dispatch event to services that the app became visible
        window.dispatchEvent(new CustomEvent("app-became-visible"));
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Also handle focus event which may fire before visibilitychange on some browsers
  window.addEventListener("focus", () => {
    if (!document.hidden) {
      console.log("[AppInitialization] Focus event - app became visible");
      window.dispatchEvent(new CustomEvent("app-became-visible"));
    }
  });
};

setupVisibilityRecovery();

const serviceWorkerEnabled =
  !isDevMode() && !Capacitor.isNativePlatform();

function startApp(): void {
  bootstrapApplication(AppComponent, {
    providers: [
      providePostHogErrorHandler(),
      provideRouter(
        routes,
        withInMemoryScrolling({ scrollPositionRestoration: "top" })
      ),
      provideHttpClient(withXhr()),
      provideAnimations(),
      provideServiceWorker("ngsw-worker.js", {
        enabled: serviceWorkerEnabled,
        registrationStrategy: "registerWhenStable:30000",
      }),
      BrandingService,
      { provide: BRANDING_SERVICE_TOKEN, useExisting: BrandingService },
      {
        provide: IMAGE_CONFIG,
        useValue: {
          disableImageSizeWarning: true,
          disableImageLazyLoadWarning: true,
        },
      },
      {
        provide: APP_INITIALIZER,
        useFactory: (clientVersionGate: ClientVersionGateService) => {
          return async () => {
            try {
              const previewBlocked =
                !environment.production &&
                new URLSearchParams(window.location.search).get(
                  "force_upgrade"
                ) === "1";
              await clientVersionGate.initialize({ previewBlocked });
              const decision = clientVersionGate.getDecision();
              maybeAutoReloadWebOnce({
                blocked: decision.blocked,
                upgradeKind: decision.upgradeKind,
                reload: () => window.location.reload(),
              });
            } catch (error) {
              console.warn(
                "[AppInitialization] Client version gate failed (fail-open):",
                error
              );
            }
          };
        },
        deps: [ClientVersionGateService],
        multi: true,
      },
      {
        provide: APP_INITIALIZER,
        useFactory: (brandingService: BrandingService) => {
          return async () => {
            try {
              console.log(
                "[AppInitialization] Initializing BrandingService to load logos before rendering"
              );
              await brandingService.initialize();
              console.log(
                "[AppInitialization] BrandingService initialization complete"
              );
            } catch (error) {
              console.error(
                "[AppInitialization] BrandingService initialization failed:",
                error
              );
              // Continue initialization even if branding fails
            }
          };
        },
        deps: [BrandingService],
        multi: true,
      },
      {
        provide: APP_INITIALIZER,
        useFactory: (adminAuthService: AdminAuthService) => {
          return () => {
            console.log(
              "[AppInitialization] Initializing AdminAuthService for session restoration"
            );
            // Wait for the loading state to complete (loading goes from true -> false)
            return new Promise((resolve) => {
              let resolved = false;

              // Subscribe to loading state
              const subscription = adminAuthService.loading$.subscribe(
                (isLoading) => {
                  // Once loading completes (becomes false), resolve
                  if (!isLoading && !resolved) {
                    resolved = true;
                    console.log(
                      "[AppInitialization] AdminAuthService initialization complete"
                    );
                    subscription.unsubscribe();
                    resolve(true);
                  }
                }
              );

              // Safety timeout in case loading never completes
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  console.warn(
                    "[AppInitialization] AdminAuthService initialization timed out after 5s"
                  );
                  subscription.unsubscribe();
                  resolve(true);
                }
              }, 5000);
            });
          };
        },
        deps: [AdminAuthService],
        multi: true,
      },
    ],
  }).catch((err) => {
    console.error("[AppInitialization] Bootstrap error:", err);
    // Ensure user sees something instead of blank page
    const rootElement = document.querySelector("app-root");
    if (rootElement) {
      rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f4f6; font-family: system-ui, -apple-system, sans-serif;">
        <div style="text-align: center; padding: 2rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #374151; margin-bottom: 1rem;">Oops, something went wrong</h1>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">The application encountered an error. Attempting to recover...</p>
          <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer;">Reload Page</button>
        </div>
      </div>
    `;
    }
    // Attempt automatic reload
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  });
}

void (async () => {
  const redirected = await maybeRedirectNativeToLiveSite({
    isNative: Capacitor.isNativePlatform(),
    origin: window.location.origin,
    hostname: window.location.hostname,
    location: window.location,
    liveOrigin: CAPACITOR_LIVE_ORIGIN,
    fetchFn: fetch,
    timeoutMs: 2000,
  });
  if (!redirected) {
    startApp();
  }
})();
