import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { capturePostHogEvent } from '../../../lib/posthog';
import {
  storeUrlForPlatform,
  type ClientVersionGateDecision,
} from '../../../lib/client-version-gate';
import { ClientVersionGateService } from '../../services/client-version-gate.service';

@Component({
  selector: 'app-force-upgrade',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="safe-area-overlay flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-900"
      data-testid="force-upgrade-gate"
      role="main"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Update required
        </h1>
        <p class="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          This version of Prayer App is no longer supported. Please update
          from the App Store or Google Play to keep using the app.
        </p>
        <button
          type="button"
          class="mt-6 w-full rounded-lg bg-church-green px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          data-testid="force-upgrade-cta"
          (click)="onPrimaryAction()"
        >
          {{ isNative ? 'Update the app' : 'Refresh this page' }}
        </button>
      </div>
    </main>
  `,
})
export class ForceUpgradeComponent implements OnInit {
  private readonly gate = inject(ClientVersionGateService);
  readonly decision: ClientVersionGateDecision = this.gate.getDecision();
  readonly isNative = this.decision.surface === 'native';

  ngOnInit(): void {
    capturePostHogEvent('client_upgrade_required', {
      surface: this.decision.surface,
      platform: Capacitor.getPlatform(),
      client_version: this.decision.clientVersion,
      min_version: this.decision.minVersion,
    });
  }

  async onPrimaryAction(): Promise<void> {
    if (this.isNative) {
      const url = storeUrlForPlatform(Capacitor.getPlatform());
      await Browser.open({ url });
      return;
    }
    window.location.reload();
  }
}
