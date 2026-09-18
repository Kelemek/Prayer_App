import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalyticsConsentBannerComponent } from './analytics-consent-banner.component';
import { PosthogService } from '../../services/posthog.service';
import { signal } from '@angular/core';

describe('AnalyticsConsentBannerComponent', () => {
  let fixture: ComponentFixture<AnalyticsConsentBannerComponent>;
  let analyticsConsent: ReturnType<typeof signal<null | 'accepted' | 'rejected'>>;
  let setUserAnalyticsConsent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    analyticsConsent = signal(null);
    setUserAnalyticsConsent = vi.fn((value: 'accepted' | 'rejected') => {
      analyticsConsent.set(value);
    });

    await TestBed.configureTestingModule({
      imports: [AnalyticsConsentBannerComponent],
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

    fixture = TestBed.createComponent(AnalyticsConsentBannerComponent);
  });

  it('shows banner when PostHog is configured and consent is missing', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="analytics-consent-banner"]')
    ).toBeTruthy();
  });

  it('hides banner after consent is set', () => {
    fixture.detectChanges();
    analyticsConsent.set('rejected');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="analytics-consent-banner"]')
    ).toBeNull();
  });

  it('calls setUserAnalyticsConsent on Accept', () => {
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('button.btn-chip-blue')
      ?.dispatchEvent(new Event('click'));
    expect(setUserAnalyticsConsent).toHaveBeenCalledWith('accepted');
  });

  it('calls setUserAnalyticsConsent on Reject', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const rejectBtn = Array.from(buttons).find(
      (b: Element) => b.textContent?.trim() === 'Reject'
    ) as HTMLButtonElement;
    rejectBtn?.click();
    expect(setUserAnalyticsConsent).toHaveBeenCalledWith('rejected');
  });
});
