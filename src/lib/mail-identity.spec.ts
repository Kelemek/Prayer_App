import { describe, expect, it } from 'vitest';
import {
  assertFromAddressOnPlatformDomain,
  coerceMailFromLocalPart,
  mailFromLocalPartError,
  mailFromNameError,
  mailReplyToError,
  platformDomainFromSenderAddress,
  resolveMailIdentity,
} from './mail-identity';

const PLATFORM = {
  senderAddress: 'noreply@prayer.example.com',
  fromName: 'Prayer Ministry',
};

describe('mail-identity', () => {
  it('extracts the domain from MAIL_SENDER_ADDRESS', () => {
    expect(platformDomainFromSenderAddress('noreply@prayer.example.com')).toBe(
      'prayer.example.com'
    );
    expect(platformDomainFromSenderAddress('not-an-email')).toBeNull();
  });

  it('sanitizes dns-safe local-parts and rejects the rest', () => {
    expect(coerceMailFromLocalPart(' CrossPointe ')).toBe('crosspointe');
    expect(coerceMailFromLocalPart('a')).toBe('a');
    expect(coerceMailFromLocalPart('church-name')).toBe('church-name');
    expect(coerceMailFromLocalPart('')).toBeNull();
    expect(coerceMailFromLocalPart('-bad')).toBeNull();
    expect(coerceMailFromLocalPart('bad-')).toBeNull();
    expect(coerceMailFromLocalPart('has.dot')).toBeNull();
    expect(mailFromLocalPartError('has_underscore')).toContain('lowercase');
  });

  it('rejects display names and reply-to values that would break headers', () => {
    expect(mailFromNameError('Cross Pointe Prayer')).toBeNull();
    expect(mailFromNameError('Name <spoof@x.com>')).not.toBeNull();
    expect(mailReplyToError('office@church.org')).toBeNull();
    expect(mailReplyToError('not-email')).not.toBeNull();
  });

  it('uses tenant name + local-part when set', () => {
    const identity = resolveMailIdentity(PLATFORM, {
      mailFromName: 'Cross Pointe Prayer',
      mailFromLocalPart: 'crosspointe',
      mailReplyTo: 'prayer@crosspointe.church',
    });
    expect(identity.fromHeader).toBe(
      'Cross Pointe Prayer <crosspointe@prayer.example.com>'
    );
    expect(identity.fromAddress).toBe('crosspointe@prayer.example.com');
    expect(identity.replyTo).toBe('prayer@crosspointe.church');
    expect(identity.listUnsubscribeMailto).toBe(PLATFORM.senderAddress);
  });

  it('falls back to platform MAIL_* when tenant overrides are null', () => {
    const identity = resolveMailIdentity(PLATFORM, {
      mailFromName: null,
      mailFromLocalPart: null,
      mailReplyTo: null,
    });
    expect(identity.fromHeader).toBe('Prayer Ministry <noreply@prayer.example.com>');
    expect(identity.replyTo).toBeNull();
  });

  it('falls back to platform when tenant is missing', () => {
    const identity = resolveMailIdentity(PLATFORM, null);
    expect(identity.fromAddress).toBe(PLATFORM.senderAddress);
    expect(identity.fromName).toBe(PLATFORM.fromName);
  });

  it('rejects from-addresses that leave the platform domain', () => {
    expect(() =>
      assertFromAddressOnPlatformDomain('spoof@other.com', PLATFORM.senderAddress)
    ).toThrow(/platform verified Resend domain/);
  });

  it('ignores invalid stored local-parts instead of sending a spoof domain', () => {
    const identity = resolveMailIdentity(PLATFORM, {
      mailFromName: 'Church A',
      mailFromLocalPart: 'not@other.com',
      mailReplyTo: null,
    });
    expect(identity.fromAddress).toBe(PLATFORM.senderAddress);
    expect(identity.fromName).toBe('Church A');
  });
});
