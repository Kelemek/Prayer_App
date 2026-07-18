import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserSettingsAppearanceSectionComponent } from './user-settings-appearance-section.component';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsAppearanceSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsAppearanceSectionComponent>;
  let component: UserSettingsAppearanceSectionComponent;

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsAppearanceSectionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserSettingsAppearanceSectionComponent);
    component = fixture.componentInstance;
    component.theme = 'light';
    component.textSize = 'normal';
    fixture.detectChanges();
  });

  it('renders theme and text size sections', () => {
    expect(fixture.nativeElement.textContent).toContain('Theme Preference');
    expect(fixture.nativeElement.textContent).toContain('Text size');
  });

  it('emits themeChange when selecting dark theme', () => {
    const themeChange = vi.fn();
    component.themeChange.subscribe(themeChange);
    fixture.nativeElement
      .querySelector('[title="Use dark theme for the application"]')
      .click();
    expect(themeChange).toHaveBeenCalledWith('dark');
  });

  it('emits textSizeChange when selecting larger text', () => {
    const textSizeChange = vi.fn();
    component.textSizeChange.subscribe(textSizeChange);
    fixture.nativeElement.querySelector('[title="Larger text"]').click();
    expect(textSizeChange).toHaveBeenCalledWith('large');
  });
});
