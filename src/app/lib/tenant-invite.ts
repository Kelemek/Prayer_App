export const TENANT_INVITE_TEMPLATE_KEY = 'tenant_invite';

export type TenantInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TenantInvitePreview {
  tenantName: string;
  tenantSlug: string;
  inviteeEmail: string;
  expiresAt: string;
  status: TenantInviteStatus;
}

export interface CreatedTenantInvite {
  token: string;
  url: string;
}

export class InviteEmailSendError extends Error {
  readonly token: string;
  readonly url: string;

  constructor(message: string, token: string, url: string) {
    super(message);
    this.name = 'InviteEmailSendError';
    this.token = token;
    this.url = url;
  }
}

export type JoinInviteState =
  | 'missing-token'
  | 'not-found'
  | 'accepted'
  | 'revoked'
  | 'expired'
  | 'mismatch'
  | 'ready';

export function parseJoinInviteToken(returnUrl: string | null | undefined): string | null {
  if (!returnUrl) {
    return null;
  }
  const path = returnUrl.split('?')[0]?.trim() ?? '';
  const match = path.match(/\/join\/([^/]+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return null;
  }
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function emailsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').toLowerCase().trim() === (right ?? '').toLowerCase().trim()
    && (left ?? '').trim() !== '';
}

export function isInviteExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  const expires = new Date(expiresAt).getTime();
  return Number.isNaN(expires) || expires < nowMs;
}

export function formatInviteExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function describeJoinInviteState(
  token: string | null,
  preview: TenantInvitePreview | null,
  currentEmail: string | null,
  nowMs: number = Date.now()
): JoinInviteState {
  if (!token) {
    return 'missing-token';
  }
  if (!preview) {
    return 'not-found';
  }
  switch (preview.status) {
    case 'accepted':
      return 'accepted';
    case 'revoked':
      return 'revoked';
    case 'expired':
      return 'expired';
    case 'pending':
      if (isInviteExpired(preview.expiresAt, nowMs)) {
        return 'expired';
      }
      if (currentEmail && !emailsMatch(currentEmail, preview.inviteeEmail)) {
        return 'mismatch';
      }
      return 'ready';
    default: {
      const _exhaustive: never = preview.status;
      return _exhaustive;
    }
  }
}

interface TenantInvitePreviewRow {
  tenant_name?: unknown;
  tenant_slug?: unknown;
  invitee_email?: unknown;
  expires_at?: unknown;
  status?: unknown;
}

function isTenantInviteStatus(value: unknown): value is TenantInviteStatus {
  return value === 'pending' || value === 'accepted' || value === 'expired' || value === 'revoked';
}

export function mapTenantInvitePreview(raw: unknown): TenantInvitePreview | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as TenantInvitePreviewRow;
  const tenantName = typeof row.tenant_name === 'string' ? row.tenant_name.trim() : '';
  const tenantSlug = typeof row.tenant_slug === 'string' ? row.tenant_slug.trim() : '';
  const inviteeEmail = typeof row.invitee_email === 'string' ? row.invitee_email.toLowerCase().trim() : '';
  const expiresAt = typeof row.expires_at === 'string' ? row.expires_at : '';
  if (!tenantName || !inviteeEmail || !expiresAt || !isTenantInviteStatus(row.status)) {
    return null;
  }
  return {
    tenantName,
    tenantSlug,
    inviteeEmail,
    expiresAt,
    status: row.status,
  };
}
