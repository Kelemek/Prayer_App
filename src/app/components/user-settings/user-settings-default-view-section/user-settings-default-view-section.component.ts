import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';
import {
  HOME_DEFAULT_PRAYER_VIEW_OPTIONS,
  homeDefaultPrayerViewDescription,
  type HomeDefaultPrayerView,
} from '../../../lib/home-default-view-preference';

@Component({
  selector: 'app-user-settings-default-view-section',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-default-view-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsDefaultViewSectionComponent {
  readonly defaultViewOptions = HOME_DEFAULT_PRAYER_VIEW_OPTIONS;

  @Input() defaultViewPreferencesLoaded = false;
  @Input() defaultPrayerView: HomeDefaultPrayerView | null = null;
  @Input() savingDefaultView = false;
  @Input() successDefaultView: string | null = null;

  @Output() defaultPrayerViewChange = new EventEmitter<HomeDefaultPrayerView>();

  defaultViewHint(): string {
    if (this.savingDefaultView) {
      return 'Saving...';
    }
    if (!this.defaultPrayerView) {
      return '';
    }
    return homeDefaultPrayerViewDescription(this.defaultPrayerView);
  }
}
