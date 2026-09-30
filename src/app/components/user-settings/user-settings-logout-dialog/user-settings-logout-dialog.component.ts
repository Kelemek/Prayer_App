import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';
import { AppTopChromeOverlayDirective } from '../../../directives/app-top-chrome-overlay.directive';

@Component({
  selector: 'app-user-settings-logout-dialog',
  standalone: true,
  imports: [AppTopChromeOverlayDirective],
  templateUrl: './user-settings-logout-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsLogoutDialogComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
