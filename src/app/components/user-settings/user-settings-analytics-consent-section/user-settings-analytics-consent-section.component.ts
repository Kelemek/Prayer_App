import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnabledDisabledToggleComponent } from '../../enabled-disabled-toggle/enabled-disabled-toggle.component';
import { PosthogService } from '../../../services/posthog.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-analytics-consent-section',
  standalone: true,
  imports: [EnabledDisabledToggleComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-analytics-consent-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsAnalyticsConsentSectionComponent {
  readonly posthog = inject(PosthogService);

  readonly showSection = computed(() => this.posthog.posthogConfigured);

  readonly toggleValue = computed(() => {
    const consent = this.posthog.analyticsConsent();
    if (consent === 'accepted') {
      return true;
    }
    if (consent === 'rejected') {
      return false;
    }
    return null;
  });

  onConsentChange(enabled: boolean): void {
    this.posthog.setUserAnalyticsConsent(enabled ? 'accepted' : 'rejected');
  }
}
