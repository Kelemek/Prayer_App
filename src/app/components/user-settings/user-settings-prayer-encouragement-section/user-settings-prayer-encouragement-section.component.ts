import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-prayer-encouragement-section',
  standalone: true,
  imports: [NgClass, CommonModule, FormsModule],
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
  @Input() personalPrayerCooldownHours = 4;
  @Input() savingPersonalPrayerCooldown = false;

  @Output() showPrayForButtonChange = new EventEmitter<boolean>();
  @Output() showPrayingCountChange = new EventEmitter<boolean>();
  @Output() personalPrayerCooldownHoursChange = new EventEmitter<number>();

  personalPrayerCooldownEdited = false;

  onPersonalPrayerCooldownChange(): void {
    this.personalPrayerCooldownEdited = true;
  }

  savePersonalPrayerCooldownHours(): void {
    if (this.personalPrayerCooldownEdited) {
      this.personalPrayerCooldownHoursChange.emit(this.personalPrayerCooldownHours);
    }
  }
}
