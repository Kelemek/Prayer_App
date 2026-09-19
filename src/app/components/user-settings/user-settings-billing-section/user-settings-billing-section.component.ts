import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { UserSubscriptionService } from '../../../services/user-subscription.service';
import { ProCheckoutService } from '../../../services/pro-checkout.service';
import { ToastService } from '../../../services/toast.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-billing-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-billing-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsBillingSectionComponent implements OnInit {
  private readonly userSubscription = inject(UserSubscriptionService);
  private readonly proCheckout = inject(ProCheckoutService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  showSection = false;
  busy = false;

  async ngOnInit(): Promise<void> {
    await this.userSubscription.refreshCapabilities();
    this.showSection = this.userSubscription.hasProBillingPortal();
    this.cdr.markForCheck();
  }

  async onBillingPortal(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const url = await this.proCheckout.startBillingPortal();
      if (!url) {
        this.toast.error('Could not open billing portal. Please try again.');
        return;
      }
      await this.proCheckout.openBillingUrl(url);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
