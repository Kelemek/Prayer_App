import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';

@Component({
  selector: 'app-user-settings-error-banner',
  standalone: true,
  templateUrl: './user-settings-error-banner.component.html',
  styles: [':host:not(:has([role="alert"])) { display: none; }'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsErrorBannerComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
