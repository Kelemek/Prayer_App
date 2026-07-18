import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-default-view-section',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-default-view-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsDefaultViewSectionComponent {
  @Input() defaultViewPreferencesLoaded = false;
  @Input() defaultPrayerView: 'current' | 'personal' | null = null;
  @Input() savingDefaultView = false;
  @Input() successDefaultView: string | null = null;

  @Output() defaultPrayerViewChange = new EventEmitter<'current' | 'personal'>();
}
