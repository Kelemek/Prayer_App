import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { EnabledDisabledToggleComponent } from '../../enabled-disabled-toggle/enabled-disabled-toggle.component';
import { CapacitorService } from '../../../services/capacitor.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-notification-preferences-section',
  standalone: true,
  imports: [EnabledDisabledToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-notification-preferences-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsNotificationPreferencesSectionComponent {
  @Input() preferencesLoaded = false;
  @Input() receiveNotifications: boolean | null = null;
  @Input() savingNotification = false;
  @Input() successNotification: string | null = null;

  @Input() receivePushNotifications: boolean | null = null;
  @Input() savingPushNotification = false;
  @Input() successPushNotification: string | null = null;

  @Input() badgePreferencesLoaded = false;
  @Input() badgeFunctionalityEnabled: boolean | null = null;
  @Input() savingBadge = false;
  @Input() successBadge: string | null = null;

  @Output() receiveNotificationsChange = new EventEmitter<boolean>();
  @Output() receivePushNotificationsChange = new EventEmitter<boolean>();
  @Output() badgeFunctionalityEnabledChange = new EventEmitter<boolean>();

  constructor(public capacitorService: CapacitorService) {}
}
