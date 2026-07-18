import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CapacitorService } from '../../../services/capacitor.service';
import { UserSettingsNotificationPreferencesSectionComponent } from './user-settings-notification-preferences-section.component';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsNotificationPreferencesSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsNotificationPreferencesSectionComponent>;
  let component: UserSettingsNotificationPreferencesSectionComponent;

  const capacitorMock = {
    showPushNotificationSetting: vi.fn(() => true),
    isNative: vi.fn(() => false),
  };

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsNotificationPreferencesSectionComponent],
      providers: [{ provide: CapacitorService, useValue: capacitorMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(UserSettingsNotificationPreferencesSectionComponent);
    component = fixture.componentInstance;
  });

  it('forwards email notification toggle value to parent', () => {
    const receiveNotificationsChange = vi.fn();
    component.receiveNotificationsChange.subscribe(receiveNotificationsChange);
    component.preferencesLoaded = true;
    component.receiveNotifications = true;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[title="Disable email notifications"]').click();
    expect(receiveNotificationsChange).toHaveBeenCalledWith(false);
  });

  it('forwards badge toggle value to parent', () => {
    const badgeFunctionalityEnabledChange = vi.fn();
    component.badgeFunctionalityEnabledChange.subscribe(badgeFunctionalityEnabledChange);
    component.badgePreferencesLoaded = true;
    component.badgeFunctionalityEnabled = false;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[title="Enable notification badges"]').click();
    expect(badgeFunctionalityEnabledChange).toHaveBeenCalledWith(true);
  });

  it('shows push section when capacitor allows it', () => {
    component.preferencesLoaded = true;
    component.receivePushNotifications = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Push Notifications');
  });
});
