export const ANALYTICS_CONSENT_KEY = 'prayerapp.analytics_consent';

export type AnalyticsConsentValue = 'accepted' | 'rejected';

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAnalyticsConsent(): AnalyticsConsentValue | null {
  if (!isStorageAvailable()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (raw === 'accepted' || raw === 'rejected') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: AnalyticsConsentValue): void {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // ignore quota / private mode
  }
}

export function isAnalyticsConsentAccepted(): boolean {
  return getAnalyticsConsent() === 'accepted';
}
