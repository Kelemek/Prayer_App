import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  canManageChurchBilling,
  churchBillingBannerMessage,
  isChurchPlanTier,
  shouldShowChurchCheckout,
  type ChurchBillingTenant,
} from '../../lib/church-billing';
import { ChurchCheckoutService } from '../../services/church-checkout.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-church-billing-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bannerMessage || showManageBilling || showCheckout) {
      <div
        class="mb-6 rounded-lg border px-4 py-3 text-sm"
        [class]="bannerClass"
        role="status"
      >
        @if (bannerMessage) {
          <p class="mb-2">{{ bannerMessage }}</p>
        }
        <div class="flex flex-wrap gap-2">
          @if (showManageBilling) {
            <button
              type="button"
              (click)="onManageBilling()"
              [disabled]="busy"
              class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
            >
              {{ busy ? 'Opening…' : 'Billing & invoices' }}
            </button>
          }
          @if (showCheckout) {
            <button
              type="button"
              (click)="onCheckout()"
              [disabled]="busy"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
            >
              {{ busy ? 'Opening…' : 'Complete Church checkout' }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class AdminChurchBillingBannerComponent implements OnChanges {
  @Input({ required: true }) tenant: ChurchBillingTenant | null = null;
  @Input() canManage = false;

  bannerMessage: string | null = null;
  showManageBilling = false;
  showCheckout = false;
  busy = false;

  constructor(
    private churchCheckout: ChurchCheckoutService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tenant'] || changes['canManage']) {
      this.refreshState();
    }
  }

  get bannerClass(): string {
    const tenant = this.tenant;
    if (tenant?.plan_status === 'past_due') {
      return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100';
    }
    return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-100';
  }

  private refreshState(): void {
    const tenant = this.tenant;
    if (!tenant || !isChurchPlanTier(tenant) || !this.canManage) {
      this.bannerMessage = null;
      this.showManageBilling = false;
      this.showCheckout = false;
      return;
    }

    this.bannerMessage = churchBillingBannerMessage(tenant);
    this.showManageBilling = canManageChurchBilling(tenant);
    this.showCheckout =
      !this.churchCheckout.isNativeStripeCheckoutUi() && shouldShowChurchCheckout(tenant);
    this.cdr.markForCheck();
  }

  async onManageBilling(): Promise<void> {
    const tenant = this.tenant;
    if (!tenant || this.busy) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const url = await this.churchCheckout.startBillingPortal(tenant.id, tenant.slug);
      if (!url) {
        this.toast.error('Could not open billing portal. Please try again.');
        return;
      }
      await this.churchCheckout.openBillingUrl(url);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  async onCheckout(): Promise<void> {
    const tenant = this.tenant;
    if (!tenant || this.busy) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const url = await this.churchCheckout.startChurchCheckout(tenant.id, tenant.slug);
      if (!url) {
        this.toast.error('Could not start checkout. Please try again.');
        return;
      }
      await this.churchCheckout.openBillingUrl(url);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
