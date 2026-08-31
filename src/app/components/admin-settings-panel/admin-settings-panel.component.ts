import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { AppBrandingComponent } from '../app-branding/app-branding.component';
import { PromptManagerComponent } from '../prompt-manager/prompt-manager.component';
import { PrayerTypesManagerComponent } from '../prayer-types-manager/prayer-types-manager.component';
import { EmailSettingsComponent } from '../email-settings/email-settings.component';
import { EmailSubscribersComponent } from '../email-subscribers/email-subscribers.component';
import { AdminSubscriberEmailBroadcastComponent } from '../admin-subscriber-email-broadcast/admin-subscriber-email-broadcast.component';
import { EmailTemplatesManagerComponent } from '../email-templates-manager/email-templates-manager.component';
import { HourlyReminderTemplateSectionComponent } from '../hourly-reminder-template-section/hourly-reminder-template-section.component';
import { AdminUserManagementComponent } from '../admin-user-management/admin-user-management.component';
import { PrayerSearchComponent } from '../prayer-search/prayer-search.component';
import { PrayerArchiveTimelineComponent } from '../prayer-archive-timeline/prayer-archive-timeline.component';
import { BackupStatusComponent } from '../backup-status/backup-status.component';
import { SecurityPolicySettingsComponent } from '../security-policy-settings/security-policy-settings.component';
import { TestAccountSettingsComponent } from '../test-account-settings/test-account-settings.component';
import { GitHubSettingsComponent } from '../github-settings/github-settings.component';
import { GitHubFeedbackFormComponent } from '../github-feedback-form/github-feedback-form.component';
import { PrayerEncouragementSettingsComponent } from '../prayer-encouragement-settings/prayer-encouragement-settings.component';
import { MemorizationRecommendationsManagerComponent } from '../memorization-recommendations-manager/memorization-recommendations-manager.component';
import { VerseMemorizationPrayerManagerComponent } from '../verse-memorization-prayer-manager/verse-memorization-prayer-manager.component';
import { MemorizationReciteSettingsComponent } from '../memorization-recite-settings/memorization-recite-settings.component';
import { TenantManagementComponent } from '../tenant-management/tenant-management.component';
import { TenantUsersComponent } from '../tenant-users/tenant-users.component';
import { AdminPlatformPlanSettingsComponent } from '../admin-platform-plan-settings/admin-platform-plan-settings.component';
import { AdminSiteAnalyticsPanelComponent } from '../admin-site-analytics-panel/admin-site-analytics-panel.component';
import { ADMIN_SETTINGS_TABS, type AdminSettingsTab, type AdminSettingsTabDef } from '../../lib/admin-settings-tabs';
import type { AnalyticsStats } from '../../services/analytics.service';

@Component({
  selector: 'app-admin-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminSiteAnalyticsPanelComponent,
    AppBrandingComponent,
    PromptManagerComponent,
    PrayerTypesManagerComponent,
    EmailSettingsComponent,
    EmailSubscribersComponent,
    AdminSubscriberEmailBroadcastComponent,
    EmailTemplatesManagerComponent,
    HourlyReminderTemplateSectionComponent,
    AdminUserManagementComponent,
    PrayerSearchComponent,
    PrayerArchiveTimelineComponent,
    BackupStatusComponent,
    SecurityPolicySettingsComponent,
    TestAccountSettingsComponent,
    GitHubSettingsComponent,
    GitHubFeedbackFormComponent,
    PrayerEncouragementSettingsComponent,
    MemorizationRecommendationsManagerComponent,
    VerseMemorizationPrayerManagerComponent,
    MemorizationReciteSettingsComponent,
    TenantManagementComponent,
    TenantUsersComponent,
    AdminPlatformPlanSettingsComponent,
  ],
  templateUrl: './admin-settings-panel.component.html',
})
export class AdminSettingsPanelComponent {
  @Input({ required: true }) activeSettingsTab!: AdminSettingsTab;
  @Input({ required: true }) analyticsStats!: AnalyticsStats;
  @Input() showAnalyticsTab = true;
  @Input() isSuperAdmin = false;
  @Input() githubFeedbackEnabled = false;

  @Output() settingsTabChange = new EventEmitter<AdminSettingsTab>();
  @Output() githubSettingsSaved = new EventEmitter<void>();

  readonly hourlyMemorizationReminderTemplateOptions = [
    { value: 'user_hourly_memorization_reminder', label: 'Simple nudge (default)' },
    {
      value: 'user_hourly_memorization_reminder_with_spotlight',
      label: 'Spotlight — item needing the most practice',
    },
  ] as const;

  readonly hourlyMemorizationAllowedKeys = [
    'user_hourly_memorization_reminder',
    'user_hourly_memorization_reminder_with_spotlight',
  ] as const;

  get visibleSettingsTabs(): AdminSettingsTabDef[] {
    return ADMIN_SETTINGS_TABS.filter((tab) => this.isSettingsTabVisible(tab.id));
  }

  isSettingsTabVisible(tab: AdminSettingsTab): boolean {
    switch (tab) {
      case 'analytics':
        return this.showAnalyticsTab;
      case 'tenant_manager':
        return this.isSuperAdmin;
      case 'content':
      case 'email':
      case 'tools':
      case 'security':
        return true;
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  }
}
