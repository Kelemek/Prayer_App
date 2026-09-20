import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { capturePostHogEvent } from '../../../lib/posthog';
import { isCapacitorBundledBootOrigin } from '../../../lib/capacitor-live-boot';
import {
  forceUpgradeBodyForDecision,
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
          {{ bodyText }}
        </p>
        <button
          type="button"
          class="mt-6 w-full rounded-lg bg-church-green px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          data-testid="force-upgrade-cta"
          (click)="onPrimaryAction()"
        >
          {{ ctaLabel }}
        </button>
      </div>
    </main>
  `,
})
export class ForceUpgradeComponent implements OnInit {
  private readonly gate = inject(ClientVersionGateService);
  readonly decision: ClientVersionGateDecision = this.gate.getDecision();
  readonly bodyText = forceUpgradeBodyForDecision(this.decision, {
    onBundledCapacitorOrigin: isCapacitorBundledBootOrigin(
      window.location.origin,
      window.location.hostname
    ),
  });
  readonly ctaLabel =
    this.decision.upgradeKind === 'store' ? 'Update the app' : 'Refresh this page';

  ngOnInit(): void {
    capturePostHogEvent('client_upgrade_required', {
      surface: this.decision.surface,
      upgrade_kind: this.decision.upgradeKind,
      platform: Capacitor.getPlatform(),
      client_version: this.decision.clientVersion,
      min_version: this.decision.minVersion,
    });
  }

  async onPrimaryAction(): Promise<void> {
    if (this.decision.upgradeKind === 'store') {
      const url = storeUrlForPlatform(Capacitor.getPlatform());
      await Browser.open({ url });
      return;
    }
    window.location.reload();
  }
}
