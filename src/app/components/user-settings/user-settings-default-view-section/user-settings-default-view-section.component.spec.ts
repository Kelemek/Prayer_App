import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserSettingsDefaultViewSectionComponent } from './user-settings-default-view-section.component';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsDefaultViewSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsDefaultViewSectionComponent>;
  let component: UserSettingsDefaultViewSectionComponent;

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsDefaultViewSectionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserSettingsDefaultViewSectionComponent);
    component = fixture.componentInstance;
  });

  it('shows skeleton when preferences are not loaded', () => {
    component.defaultViewPreferencesLoaded = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('emits defaultPrayerViewChange when personal view is selected', () => {
    const defaultPrayerViewChange = vi.fn();
    component.defaultPrayerViewChange.subscribe(defaultPrayerViewChange);
    component.defaultViewPreferencesLoaded = true;
    component.defaultPrayerView = 'current';
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[title="Open personal prayers by default"]').click();
    expect(defaultPrayerViewChange).toHaveBeenCalledWith('personal');
  });

  it('emits groups when group prayers is selected', () => {
    const defaultPrayerViewChange = vi.fn();
    component.defaultPrayerViewChange.subscribe(defaultPrayerViewChange);
    component.defaultViewPreferencesLoaded = true;
    component.defaultPrayerView = 'current';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Church Prayers');
    expect(fixture.nativeElement.textContent).toContain('Group Prayers');
    fixture.nativeElement.querySelector('[title="Open group prayers by default"]').click();
    expect(defaultPrayerViewChange).toHaveBeenCalledWith('groups');
  });

  it('shows success message when provided', () => {
    component.defaultViewPreferencesLoaded = true;
    component.defaultPrayerView = 'personal';
    component.successDefaultView = '✅ Default view set to Personal Prayers';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('✅ Default view set to Personal Prayers');
  });
});
