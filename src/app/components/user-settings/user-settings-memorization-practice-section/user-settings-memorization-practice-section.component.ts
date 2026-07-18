import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { EnabledDisabledToggleComponent } from '../../enabled-disabled-toggle/enabled-disabled-toggle.component';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

@Component({
  selector: 'app-user-settings-memorization-practice-section',
  standalone: true,
  imports: [EnabledDisabledToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-memorization-practice-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsMemorizationPracticeSectionComponent {
  @Input() memorizationStrictModeLoaded = false;
  @Input() memorizationStrictMode = false;
  @Input() savingMemorizationStrictMode = false;

  @Output() memorizationStrictModeChange = new EventEmitter<boolean>();
}
