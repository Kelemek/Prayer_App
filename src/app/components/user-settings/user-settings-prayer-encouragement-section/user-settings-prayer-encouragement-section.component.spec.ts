import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserSettingsPrayerEncouragementSectionComponent } from './user-settings-prayer-encouragement-section.component';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsPrayerEncouragementSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsPrayerEncouragementSectionComponent>;
  let component: UserSettingsPrayerEncouragementSectionComponent;

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsPrayerEncouragementSectionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserSettingsPrayerEncouragementSectionComponent);
    component = fixture.componentInstance;
  });

  it('shows skeleton while prayer encouragement UI loads', () => {
    component.prayerEncouragementUiLoaded = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('emits showPrayForButtonChange when Show is clicked', () => {
    const showPrayForButtonChange = vi.fn();
    component.showPrayForButtonChange.subscribe(showPrayForButtonChange);
    component.prayerEncouragementUiLoaded = true;
    component.showPrayForButton = false;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[title="Show Pray For button on prayer cards"]').click();
    expect(showPrayForButtonChange).toHaveBeenCalledWith(true);
  });

  it('emits showPrayingCountChange when Hide praying count is clicked', () => {
    const showPrayingCountChange = vi.fn();
    component.showPrayingCountChange.subscribe(showPrayingCountChange);
    component.prayerEncouragementUiLoaded = true;
    component.showPrayingCount = true;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[title="Hide Praying # button on prayer cards"]').click();
    expect(showPrayingCountChange).toHaveBeenCalledWith(false);
  });
});
