import { describe, expect, it } from 'vitest';
import {
  describeJoinInviteState,
  emailsMatch,
  formatInviteExpiry,
  InviteEmailSendError,
  mapTenantInvitePreview,
  parseJoinInviteToken,
} from './tenant-invite';

describe('tenant-invite helpers', () => {
  it('parseJoinInviteToken reads /join/:token from returnUrl', () => {
    expect(parseJoinInviteToken('/join/abc-123')).toBe('abc-123');
    expect(parseJoinInviteToken('/join/abc%2F123?x=1')).toBe('abc/123');
    expect(parseJoinInviteToken('/login')).toBeNull();
    expect(parseJoinInviteToken('')).toBeNull();
  });

  it('mapTenantInvitePreview maps snake_case RPC payload', () => {
    expect(
      mapTenantInvitePreview({
        tenant_name: 'Alpha Church',
        tenant_slug: 'alpha',
        invitee_email: ' Member@Example.com ',
        expires_at: '2026-09-17T00:00:00.000Z',
        status: 'pending',
      })
    ).toEqual({
      tenantName: 'Alpha Church',
      tenantSlug: 'alpha',
      inviteeEmail: 'member@example.com',
      expiresAt: '2026-09-17T00:00:00.000Z',
      status: 'pending',
    });
    expect(mapTenantInvitePreview('ok')).toBeNull();
    expect(mapTenantInvitePreview(null)).toBeNull();
  });

  it('describeJoinInviteState covers pending, mismatch, and terminal statuses', () => {
    const preview = {
      tenantName: 'Alpha',
      tenantSlug: 'alpha',
      inviteeEmail: 'member@example.com',
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'pending' as const,
    };
    expect(describeJoinInviteState(null, preview, 'member@example.com')).toBe('missing-token');
    expect(describeJoinInviteState('tok', null, 'member@example.com')).toBe('not-found');
    expect(describeJoinInviteState('tok', preview, 'member@example.com')).toBe('ready');
    expect(describeJoinInviteState('tok', preview, 'other@example.com')).toBe('mismatch');
    expect(
      describeJoinInviteState('tok', { ...preview, status: 'accepted' }, 'member@example.com')
    ).toBe('accepted');
    expect(
      describeJoinInviteState('tok', { ...preview, status: 'revoked' }, 'member@example.com')
    ).toBe('revoked');
    expect(
      describeJoinInviteState(
        'tok',
        { ...preview, expiresAt: '2000-01-01T00:00:00.000Z' },
        'member@example.com'
      )
    ).toBe('expired');
  });

  it('emailsMatch is case-insensitive and InviteEmailSendError carries token/url', () => {
    expect(emailsMatch('A@B.com', 'a@b.com')).toBe(true);
    expect(emailsMatch('', '')).toBe(false);
    const err = new InviteEmailSendError('fail', 'tok', 'https://example/join/tok');
    expect(err).toBeInstanceOf(Error);
    expect(err.token).toBe('tok');
    expect(err.url).toBe('https://example/join/tok');
  });

  it('formatInviteExpiry returns a readable date', () => {
    expect(formatInviteExpiry('not-a-date')).toBe('not-a-date');
    expect(formatInviteExpiry('2026-09-17T12:00:00.000Z')).toMatch(/2026/);
  });
});
