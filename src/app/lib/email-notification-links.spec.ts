import { describe, expect, it } from 'vitest';
import {
  buildAdminPortalLink,
  buildAppHomeLink,
  buildGroupsTabAppLink,
  buildMemorizeVerseAppLink,
  buildSubscriberAppLink,
  buildViewPrayerAppLink,
  resolveEmailBaseUrl,
} from './email-notification-links';

describe('email-notification-links', () => {
  it('resolveEmailBaseUrl uses production origin when not localhost', () => {
    expect(
      resolveEmailBaseUrl({
        origin: 'https://prayer.example.com',
        appUrl: 'https://fallback.example.com',
      })
    ).toBe('https://prayer.example.com');
  });

  it('resolveEmailBaseUrl falls back to appUrl on capacitor/localhost', () => {
    expect(
      resolveEmailBaseUrl({
        origin: 'https://localhost',
        appUrl: 'https://app.example.com/',
      })
    ).toBe('https://app.example.com');
  });

  it('buildSubscriberAppLink selects answered filter', () => {
    expect(buildSubscriberAppLink('https://app.example.com', 'answered')).toContain(
      'filter=answered'
    );
    expect(buildSubscriberAppLink('https://app.example.com', 'current')).toContain(
      'filter=current'
    );
  });

  it('builds home, admin, memorize, prayer, and groups links', () => {
    expect(buildAppHomeLink('https://app.example.com/')).toBe('https://app.example.com/');
    expect(buildAdminPortalLink('https://app.example.com')).toBe(
      'https://app.example.com/admin'
    );
    expect(buildMemorizeVerseAppLink('https://app.example.com', 'John 3:16', 'esv')).toContain(
      'filter=memorize'
    );
    expect(buildViewPrayerAppLink('https://app.example.com', 'p1')).toContain('prayerId=p1');
    expect(buildGroupsTabAppLink('https://app.example.com', 'g1')).toContain('groupId=g1');
    expect(buildGroupsTabAppLink('', null)).toBe('/?filter=groups');
  });
});
