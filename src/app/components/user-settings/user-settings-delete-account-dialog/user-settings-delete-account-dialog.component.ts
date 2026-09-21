import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';
import { AppTopChromeOverlayDirective } from '../../../directives/app-top-chrome-overlay.directive';

@Component({
  selector: 'app-user-settings-delete-account-dialog',
  standalone: true,
  imports: [AppTopChromeOverlayDirective],
  templateUrl: './user-settings-delete-account-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class UserSettingsDeleteAccountDialogComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
