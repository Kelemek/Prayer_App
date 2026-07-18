import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UserSettingsMemorizationPracticeSectionComponent } from './user-settings-memorization-practice-section.component';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsMemorizationPracticeSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsMemorizationPracticeSectionComponent>;
  let component: UserSettingsMemorizationPracticeSectionComponent;

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsMemorizationPracticeSectionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserSettingsMemorizationPracticeSectionComponent);
    component = fixture.componentInstance;
  });

  it('shows loading skeleton before strict mode preference loads', () => {
    component.memorizationStrictModeLoaded = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('emits inverted strict mode when Standard is selected', () => {
    const memorizationStrictModeChange = vi.fn();
    component.memorizationStrictModeChange.subscribe(memorizationStrictModeChange);
    component.memorizationStrictModeLoaded = true;
    component.memorizationStrictMode = true;
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    expect(memorizationStrictModeChange).toHaveBeenCalledWith(false);
  });

  it('describes strict mode when enabled', () => {
    component.memorizationStrictModeLoaded = true;
    component.memorizationStrictMode = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Wrong answers are not auto-solved');
  });
});
