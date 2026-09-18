import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  setAnalyticsConsent,
  isAnalyticsConsentAccepted,
} from './analytics-consent';

describe('analytics-consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when preference is missing', () => {
    expect(getAnalyticsConsent()).toBeNull();
    expect(isAnalyticsConsentAccepted()).toBe(false);
  });

  it('returns null for invalid stored values', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'maybe');
    expect(getAnalyticsConsent()).toBeNull();
  });

  it('persists and reads accepted', () => {
    setAnalyticsConsent('accepted');
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('accepted');
    expect(getAnalyticsConsent()).toBe('accepted');
    expect(isAnalyticsConsentAccepted()).toBe(true);
  });

  it('persists and reads rejected', () => {
    setAnalyticsConsent('rejected');
    expect(getAnalyticsConsent()).toBe('rejected');
    expect(isAnalyticsConsentAccepted()).toBe(false);
  });
});
