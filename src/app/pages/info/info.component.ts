import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { ThemeToggleComponent } from "../../components/theme-toggle/theme-toggle.component";
import { InfoFeatureOverviewComponent } from "../../components/info-feature-overview/info-feature-overview.component";
import {
  APP_ICON_PATH,
  DEFAULT_PUBLIC_APP_URL,
} from "../../constants/app-defaults";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-info",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ThemeToggleComponent,
    InfoFeatureOverviewComponent,
  ],
  styles: `
    /* Safe area support for notched/dynamic island devices */
    :host {
      --safe-area-inset-top: env(safe-area-inset-top, 0px);
      --safe-area-inset-right: env(safe-area-inset-right, 0px);
      --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
      --safe-area-inset-left: env(safe-area-inset-left, 0px);
    }

    .safe-area-container {
      padding-top: max(1.25rem, var(--safe-area-inset-top));
      padding-bottom: max(1.25rem, var(--safe-area-inset-bottom));
    }

    .safe-area-horizontal {
      padding-left: max(1rem, var(--safe-area-inset-left));
      padding-right: max(1rem, var(--safe-area-inset-right));
      padding-top: 2.5rem;
      padding-bottom: 4rem;
    }

    .safe-area-top-right {
      top: max(1rem, var(--safe-area-inset-top));
      right: max(1rem, var(--safe-area-inset-right));
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="relative w-full min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors safe-area-container"
    >
      <div class="absolute z-10 safe-area-top-right">
        <app-theme-toggle></app-theme-toggle>
      </div>
      <div class="max-w-6xl mx-auto safe-area-horizontal space-y-16">
        <section class="space-y-10">
          <div class="space-y-6">
            <div class="inline-flex items-center gap-4 mb-2">
              <div
                class="h-20 w-20 shrink-0 rounded-2xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center shadow-xl overflow-hidden"
              >
                <img
                  [src]="appIconPath"
                  alt="Prayer App Icon"
                  class="h-full w-full rounded-2xl object-contain shadow-xl"
                />
              </div>
              <h1
                class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight"
              >
                Prayer Community<br />
                <span class="text-emerald-600 dark:text-emerald-300"
                  >Manager</span
                >
              </h1>
            </div>
            <p
              class="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl"
            >
              Rejoice always, pray without ceasing, give thanks in all
              circumstances; for this is the will of God in Christ Jesus for
              you. <span class="whitespace-nowrap">1 Thes. 5:16–18</span>
            </p>
          </div>

          <div class="w-full grid gap-3 sm:gap-4 sm:grid-cols-3">
            <div class="w-full flex flex-col items-center gap-2">
              <button
                type="button"
                routerLink="/"
                class="group w-full inline-flex flex-row sm:flex-col items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-200/80 dark:bg-gray-800/70 px-5 py-3 hover:bg-gray-300 dark:hover:bg-gray-700 text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors cursor-pointer"
              >
                <span class="flex w-full items-center justify-center">
                  <span
                    class="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gray-300 dark:bg-gray-800"
                  >
                    <img
                      [src]="appIconPath"
                      alt=""
                      class="h-full w-full object-contain"
                    />
                  </span>
                  <span class="text-left leading-tight">
                    <span
                      class="block text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-800 dark:text-gray-400 whitespace-nowrap"
                      >Open in browser</span
                    >
                    <span class="block text-sm font-semibold whitespace-nowrap"
                      >Web Site</span
                    >
                  </span>
                </span>
                <div
                  class="h-20 w-20 min-h-20 min-w-20 shrink-0 rounded-xl border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-100 flex items-center justify-center p-1 ring-2 ring-emerald-400/50"
                  aria-hidden="true"
                >
                  @if (webAppQrUrl) {
                  <img
                    [src]="webAppQrUrl"
                    alt="QR code for web app"
                    class="h-16 w-16 shrink-0 rounded object-contain"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                  }
                </div>
                <span
                  class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-800 group-hover:dark:text-emerald-200 transition-colors"
                  >Tap or Scan</span
                >
              </button>
            </div>

            <div class="w-full flex flex-col items-center gap-2">
              <button
                type="button"
                (click)="openIosStore()"
                class="group w-full inline-flex flex-row sm:flex-col items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-200/80 dark:bg-gray-800/70 px-5 py-3 hover:bg-gray-300 dark:hover:bg-gray-700 text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors cursor-pointer"
              >
                <span class="flex w-full items-center justify-center">
                  <span
                    class="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black"
                  >
                    <span class="text-xl sm:text-2xl font-semibold text-white"
                      >&#63743;</span
                    >
                  </span>
                  <span class="text-left leading-tight">
                    <span
                      class="block text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-800 dark:text-gray-400 whitespace-nowrap"
                      >Download on the</span
                    >
                    <span class="block text-sm font-semibold whitespace-nowrap"
                      >Apple App Store</span
                    >
                  </span>
                </span>
                <div
                  class="h-20 w-20 min-h-20 min-w-20 shrink-0 rounded-xl border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-100 flex items-center justify-center p-1 ring-2 ring-emerald-400/50"
                  aria-hidden="true"
                >
                  <img
                    [src]="iosStoreQrUrl"
                    alt="QR code for App Store"
                    class="h-16 w-16 shrink-0 rounded object-contain"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                </div>
                <span
                  class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-800 group-hover:dark:text-emerald-200 transition-colors"
                  >Tap or Scan</span
                >
              </button>
            </div>

            <div class="w-full flex flex-col items-center gap-2">
              <button
                type="button"
                (click)="openAndroidStore()"
                class="group w-full inline-flex flex-row sm:flex-col items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-200/80 dark:bg-gray-800/70 px-5 py-3 hover:bg-gray-300 dark:hover:bg-gray-700 text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors cursor-pointer"
              >
                <span class="flex w-full items-center justify-center">
                  <span
                    class="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-gray-300 dark:bg-gray-800 p-0.5"
                  >
                    <img
                      src="/android-icon.svg"
                      alt=""
                      class="h-full w-full object-contain"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="text-left leading-tight">
                    <span
                      class="block text-[10px] uppercase tracking-wider text-gray-600 group-hover:text-gray-800 dark:text-gray-400 whitespace-nowrap"
                      >Download on the</span
                    >
                    <span class="block text-sm font-semibold whitespace-nowrap"
                      >Google Play Store</span
                    >
                  </span>
                </span>
                <div
                  class="h-20 w-20 min-h-20 min-w-20 shrink-0 rounded-xl border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-100 flex items-center justify-center p-1 ring-2 ring-emerald-400/50"
                  aria-hidden="true"
                >
                  <img
                    [src]="androidStoreQrUrl"
                    alt="QR code for Google Play"
                    class="h-16 w-16 shrink-0 rounded object-contain"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                </div>
                <span
                  class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-800 group-hover:dark:text-emerald-200 transition-colors"
                  >Tap or Scan</span
                >
              </button>
            </div>
          </div>

          <app-info-feature-overview />
        </section>

        <footer
          class="border-t border-gray-200 dark:border-gray-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400"
        >
          <div class="flex flex-wrap gap-4">
            <a
              routerLink="/privacy"
              class="hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
              >Privacy</a
            >
            <a
              routerLink="/support"
              class="hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
              >Support</a
            >
          </div>
          <p class="text-xs sm:text-sm">
            Already part of the community?
            <a
              routerLink="/login"
              class="text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 hover:underline"
              >Sign in</a
            >
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class InfoComponent implements OnInit {
  private readonly iosStoreUrl =
    "https://apps.apple.com/us/app/cross-pointe-prayer/id6759469929";
  private readonly androidStoreUrl =
    "https://play.google.com/store/apps/details?id=com.prayerapp.mobile";

  webAppQrUrl = "";
  iosStoreQrUrl = "";
  androidStoreQrUrl = "";
  readonly appIconPath = APP_ICON_PATH;

  ngOnInit(): void {
    const configured = environment.appUrl?.trim();
    const publicAppUrl = (
      configured && !configured.includes("localhost")
        ? configured
        : DEFAULT_PUBLIC_APP_URL
    ).replace(/\/$/, "");
    this.webAppQrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=384x384&data=" +
      encodeURIComponent(`${publicAppUrl}/`);
    this.iosStoreQrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=384x384&data=" +
      encodeURIComponent(this.iosStoreUrl);
    this.androidStoreQrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=384x384&data=" +
      encodeURIComponent(this.androidStoreUrl);
  }

  openIosStore(): void {
    window.open(this.iosStoreUrl, "_blank", "noopener");
  }

  openAndroidStore(): void {
    window.open(this.androidStoreUrl, "_blank", "noopener");
  }
}
