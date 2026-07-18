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
  selector: 'app-user-settings-prayer-encouragement-section',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-prayer-encouragement-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsPrayerEncouragementSectionComponent {
  @Input() prayerEncouragementUiLoaded = false;
  @Input() showPrayForButton: boolean | null = null;
  @Input() savingShowPrayForButton = false;
  @Input() showPrayingCount: boolean | null = null;
  @Input() savingShowPrayingCount = false;
  @Input() successPrayerEncouragementUi: string | null = null;

  @Output() showPrayForButtonChange = new EventEmitter<boolean>();
  @Output() showPrayingCountChange = new EventEmitter<boolean>();
}
