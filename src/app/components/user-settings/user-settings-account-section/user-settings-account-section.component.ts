import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';

@Component({
  selector: 'app-user-settings-account-section',
  standalone: true,
  templateUrl: './user-settings-account-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsAccountSectionComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
