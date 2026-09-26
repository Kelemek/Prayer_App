import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-account-section',
  standalone: true,
  templateUrl: './user-settings-account-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsAccountSectionComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
