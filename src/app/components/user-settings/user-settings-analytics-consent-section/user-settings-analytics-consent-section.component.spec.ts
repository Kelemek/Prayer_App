import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { UserSettingsAnalyticsConsentSectionComponent } from './user-settings-analytics-consent-section.component';
import { PosthogService } from '../../../services/posthog.service';
import {
  componentDirFromImportMeta,
  resolveComponentTemplateDir,
} from '../user-settings-section-test-utils';

describe('UserSettingsAnalyticsConsentSectionComponent', () => {
  let fixture: ComponentFixture<UserSettingsAnalyticsConsentSectionComponent>;
  let analyticsConsent: ReturnType<typeof signal<null | 'accepted' | 'rejected'>>;
  let setUserAnalyticsConsent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await resolveComponentTemplateDir(componentDirFromImportMeta(import.meta.url));
  });

  beforeEach(async () => {
    analyticsConsent = signal(null);
    setUserAnalyticsConsent = vi.fn();

    await TestBed.configureTestingModule({
      imports: [UserSettingsAnalyticsConsentSectionComponent],
      providers: [
        provideRouter([]),
        {
          provide: PosthogService,
          useValue: {
            posthogConfigured: true,
            analyticsConsent,
            setUserAnalyticsConsent,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserSettingsAnalyticsConsentSectionComponent);
  });

  it('renders when PostHog is configured', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Analytics cookies');
  });

  it('forwards Accept to PosthogService', () => {
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[title="Allow analytics cookies (PostHog)"]').click();
    expect(setUserAnalyticsConsent).toHaveBeenCalledWith('accepted');
  });
});
