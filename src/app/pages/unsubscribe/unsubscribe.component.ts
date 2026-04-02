import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { BrandingService } from '../../services/branding.service';

@Component({
  selector: 'app-unsubscribe',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div
      class="w-full min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center text-gray-900 dark:text-gray-100 transition-colors"
    >
      <div class="max-w-md w-full mx-auto space-y-8 p-4 sm:p-8 text-center">
        <!-- Same logo block as login (DB + localStorage / window cache via BrandingService) -->
        <div class="text-center mb-6">
          @if (useLogo() && logoUrl()) {
            <div class="flex justify-center mb-4">
              <img
                [src]="logoUrl()!"
                alt="Prayer Community Logo"
                class="h-16 w-auto max-w-xs object-contain"
              />
            </div>
          }
          @if (!useLogo() || !logoUrl()) {
            <svg
              class="mx-auto h-16 w-16 text-[#2F5F54] dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
          }
        </div>

        <a
          routerLink="/login"
          class="inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium mb-8"
        >
          Sign in
        </a>

        @if (state() === 'loading') {
          <div class="space-y-6" role="status" aria-live="polite" aria-busy="true">
            <!-- Same spinner + panel as login MFA “Verifying code…” state -->
            <div
              class="w-full py-4 px-4 text-center bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-400 dark:border-emerald-500 rounded-lg flex flex-col items-center justify-center gap-4"
            >
              <div class="relative w-12 h-12">
                <div
                  class="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-500 dark:border-t-emerald-400 border-r-emerald-500 dark:border-r-emerald-400"
                ></div>
                <div
                  class="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-b-emerald-300 dark:border-b-emerald-600"
                  style="animation-direction: reverse; animation-duration: 1.5s;"
                ></div>
              </div>
              <span class="text-sm font-semibold text-[#2F5F54] dark:text-emerald-300">Unsubscribing…</span>
              <p class="text-xs text-[#3a7566] dark:text-emerald-200/90 max-w-[280px]">
                {{ loadingHints[hintIndex()] }}
              </p>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Please keep this tab open while we update your email preferences.
            </p>
          </div>
        }
        @if (state() === 'success') {
          <h1 class="text-2xl font-semibold mb-3">You’re unsubscribed</h1>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            You won’t receive these emails anymore. You can turn email notifications back on anytime in the app settings.
          </p>
        }
        @if (state() === 'error') {
          <h1 class="text-2xl font-semibold mb-3">Couldn’t unsubscribe</h1>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            This link may be invalid or expired. Try signing in and updating your email preferences in Settings.
          </p>
          @if (fallbackUnsubscribeUrl()) {
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              You can also try completing unsubscribe on our mail server (opens a simple confirmation page):
            </p>
            <a
              [href]="fallbackUnsubscribeUrl()!"
              class="inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              Complete unsubscribe here
            </a>
          }
        }
        @if (state() === 'missing') {
          <h1 class="text-2xl font-semibold mb-3">Missing link</h1>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Open the unsubscribe link from your email, or sign in and change your preferences in Settings.
          </p>
        }
      </div>
    </div>
  `,
})
export class UnsubscribeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);
  private readonly branding = inject(BrandingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<'loading' | 'success' | 'error' | 'missing'>('loading');
  readonly fallbackUnsubscribeUrl = signal<string | null>(null);

  readonly useLogo = signal(false);
  readonly logoUrl = signal('');

  readonly loadingHints = [
    'Connecting securely…',
    'Updating your preferences…',
    'Almost done…',
  ] as const;
  readonly hintIndex = signal(0);

  private hintTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    void this.initializeBranding();

    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (!token) {
      this.state.set('missing');
      return;
    }

    const baseUrl = this.supabase.getSupabaseUrl().replace(/\/+$/, '');
    const key = this.supabase.getPublishableKey();
    const fnUrl = `${baseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
    this.fallbackUnsubscribeUrl.set(fnUrl);

    this.hintTimer = setInterval(() => {
      this.hintIndex.update(i => (i + 1) % this.loadingHints.length);
    }, 2800);
    this.destroyRef.onDestroy(() => this.clearHintTimer());

    void this.runUnsubscribe(fnUrl, key, token);
  }

  private async initializeBranding(): Promise<void> {
    await this.branding.initialize();
    this.branding.branding$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(branding => {
        this.useLogo.set(branding.useLogo);
        this.logoUrl.set(this.branding.getImageUrl(branding));
      });
  }

  private clearHintTimer(): void {
    if (this.hintTimer !== undefined) {
      clearInterval(this.hintTimer);
      this.hintTimer = undefined;
    }
  }

  private async runUnsubscribe(fnUrl: string, key: string, token: string): Promise<void> {
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ token }),
      });

      const text = await res.text();
      let parsed: { ok?: boolean } | null = null;
      try {
        parsed = JSON.parse(text) as { ok?: boolean };
      } catch {
        /* non-JSON */
      }

      this.clearHintTimer();

      if (res.ok && parsed?.ok === true) {
        this.state.set('success');
        return;
      }

      this.state.set('error');
    } catch (e) {
      console.error('[UnsubscribeComponent]', e);
      this.clearHintTimer();
      this.state.set('error');
    }
  }
}
