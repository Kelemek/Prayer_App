import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import type { TextSize } from '../../../services/text-size.service';
import { USER_SETTINGS_SECTION_HOST_STYLES } from '../user-settings-section-host';

export type ThemeOption = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-user-settings-appearance-section',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-settings-appearance-section.component.html',
  styles: [...USER_SETTINGS_SECTION_HOST_STYLES],
})
export class UserSettingsAppearanceSectionComponent {
  @Input({ required: true }) theme!: ThemeOption;
  @Input({ required: true }) textSize!: TextSize;

  @Output() themeChange = new EventEmitter<ThemeOption>();
  @Output() textSizeChange = new EventEmitter<TextSize>();
}
