import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { HourReminderSettingsSectionComponent } from '../../hour-reminder-settings-section/hour-reminder-settings-section.component';
import { UserSettingsPrintSectionComponent } from '../user-settings-print-section/user-settings-print-section.component';
import { UserSettingsAppearanceSectionComponent } from '../user-settings-appearance-section/user-settings-appearance-section.component';
import { UserSettingsNotificationPreferencesSectionComponent } from '../user-settings-notification-preferences-section/user-settings-notification-preferences-section.component';
import { UserSettingsPrayerEncouragementSectionComponent } from '../user-settings-prayer-encouragement-section/user-settings-prayer-encouragement-section.component';
import { UserSettingsDefaultViewSectionComponent } from '../user-settings-default-view-section/user-settings-default-view-section.component';
import { UserSettingsMemorizationPracticeSectionComponent } from '../user-settings-memorization-practice-section/user-settings-memorization-practice-section.component';
import { UserSettingsErrorBannerComponent } from '../user-settings-error-banner/user-settings-error-banner.component';
import { UserSettingsFeedbackSectionComponent } from '../user-settings-feedback-section/user-settings-feedback-section.component';
import { UserSettingsAccountSectionComponent } from '../user-settings-account-section/user-settings-account-section.component';
import type { UserSettingsFacade } from '../../../lib/user-settings-facade';

@Component({
  selector: 'app-user-settings-panel',
  standalone: true,
  imports: [
    AsyncPipe,
    HourReminderSettingsSectionComponent,
    UserSettingsPrintSectionComponent,
    UserSettingsAppearanceSectionComponent,
    UserSettingsNotificationPreferencesSectionComponent,
    UserSettingsPrayerEncouragementSectionComponent,
    UserSettingsDefaultViewSectionComponent,
    UserSettingsMemorizationPracticeSectionComponent,
    UserSettingsErrorBannerComponent,
    UserSettingsFeedbackSectionComponent,
    UserSettingsAccountSectionComponent,
  ],
  templateUrl: './user-settings-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class UserSettingsPanelComponent {
  @Input({ required: true }) host!: UserSettingsFacade;
}
