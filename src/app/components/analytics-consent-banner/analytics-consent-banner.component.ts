import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PosthogService } from '../../services/posthog.service';

@Component({
  selector: 'app-analytics-consent-banner',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (posthog.posthogConfigured && posthog.analyticsConsent() === null) {
      <div
        class="fixed bottom-0 left-0 right-0 z-[200] border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95"
        style="padding-bottom: max(1rem, env(safe-area-inset-bottom))"
        role="region"
        aria-label="Analytics cookies"
        data-testid="analytics-consent-banner"
      >
        <div
          class="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-gray-700 dark:text-gray-300 text-pretty">
            We use analytics cookies (PostHog) to understand how the app is used
            and improve it. See our
            <a
              routerLink="/privacy"
              class="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >Privacy Policy</a
            >.
          </p>
          <div class="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              class="btn-chip btn-chip-gray px-4 py-2 text-sm"
              (click)="reject()"
            >
              Reject
            </button>
            <button
              type="button"
              class="btn-chip btn-chip-blue px-4 py-2 text-sm"
              (click)="accept()"
            >
              Accept analytics
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AnalyticsConsentBannerComponent {
  readonly posthog = inject(PosthogService);

  accept(): void {
    this.posthog.setUserAnalyticsConsent('accepted');
  }

  reject(): void {
    this.posthog.setUserAnalyticsConsent('rejected');
  }
}
