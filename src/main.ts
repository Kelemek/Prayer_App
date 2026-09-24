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
import { BrandingService } from "./app/services/branding.service";
import { ClientVersionGateService } from "./app/services/client-version-gate.service";
import { BRANDING_SERVICE_TOKEN } from "./app/components/app-logo/app-logo.component";
import { providePostHogErrorHandler } from "./app/posthog-error-handler";
import { environment } from "./environments/environment";
import {
  CAPACITOR_LIVE_ORIGIN,
  buildLiveRedirectUrl,
  maybeRedirectNativeToLiveSite,
  shouldAttemptLiveRedirect,
} from "./lib/capacitor-live-boot";
import { maybeAutoReloadWebOnce } from "./lib/client-version-gate";
import { installAppForegroundSignal } from "./app/lib/app-foreground";

// One foreground signal: visibility → app-became-visible. Focus is not a second path.
const setupVisibilityRecovery = () => {
  installAppForegroundSignal({
    shouldDispatch: () => {
      const routerOutlet = document.querySelector("router-outlet");
      if (!routerOutlet) {
        console.warn(
          "[AppInitialization] Router outlet not found when page became visible"
        );
        return false;
      }
      return true;
    },
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
              await brandingService.initialize();
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
  const isNative = Capacitor.isNativePlatform();
  const redirected = await maybeRedirectNativeToLiveSite({
    isNative,
    origin: window.location.origin,
    hostname: window.location.hostname,
    location: window.location,
    liveOrigin: CAPACITOR_LIVE_ORIGIN,
    fetchFn: fetch,
    timeoutMs: 8000,
  });
  if (redirected) {
    return;
  }

  const missingSupabase =
    !environment.supabaseUrl || !environment.supabasePublishableKey;
  if (
    missingSupabase &&
    shouldAttemptLiveRedirect({
      isNative,
      origin: window.location.origin,
      hostname: window.location.hostname,
    })
  ) {
    window.location.replace(
      buildLiveRedirectUrl(CAPACITOR_LIVE_ORIGIN, window.location)
    );
    return;
  }

  startApp();
})();
