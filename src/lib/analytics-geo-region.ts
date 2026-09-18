/** EU27 + UK + EEA (IS, LI, NO). CH is not included. */
export const ANALYTICS_CONSENT_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'GB',
  'IS',
  'LI',
  'NO',
]);

export type AnalyticsGeoRegion = 'consent_required' | 'open';

export function isAnalyticsConsentRegion(countryCode: string | null | undefined): boolean {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2) {
    return false;
  }
  return ANALYTICS_CONSENT_COUNTRY_CODES.has(normalized);
}

export function regionFromCountryCode(
  countryCode: string | null | undefined
): AnalyticsGeoRegion {
  return isAnalyticsConsentRegion(countryCode) ? 'consent_required' : 'open';
}
