/**
 * Per-tenant outbound mail identity on the platform Resend domain.
 *
 * Storage is display name + local-part (not a full From address) so the sending
 * domain is always derived from `MAIL_SENDER_ADDRESS`. Custom domains are later.
 */

/** DNS-safe local-part: 1–64 chars, [a-z0-9], hyphens not at ends. */
export const MAIL_FROM_LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const MAIL_FROM_NAME_MAX = 78;
const MAIL_REPLY_TO_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export interface TenantMailOverride {
  mailFromName: string | null;
  mailFromLocalPart: string | null;
  mailReplyTo: string | null;
}

export interface PlatformMailDefaults {
  senderAddress: string;
  fromName: string;
}

export interface ResolvedMailIdentity {
  fromName: string;
  fromAddress: string;
  fromHeader: string;
  replyTo: string | null;
  /** List-Unsubscribe mailto stays on the platform address, not church reply-to. */
  listUnsubscribeMailto: string;
}

export function platformDomainFromSenderAddress(senderAddress: string): string | null {
  const trimmed = senderAddress.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }
  const domain = trimmed.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function mailFromLocalPartError(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) {
    return null;
  }
  if (!MAIL_FROM_LOCAL_PART_PATTERN.test(v)) {
    return 'Use 1–64 lowercase letters, digits, and hyphens (cannot start or end with a hyphen).';
  }
  return null;
}

export function mailFromNameError(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) {
    return null;
  }
  if (v.length > MAIL_FROM_NAME_MAX || /[<>\r\n]/.test(v)) {
    return 'Display name must be 1–78 characters and cannot contain <, >, or line breaks.';
  }
  return null;
}

export function mailReplyToError(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) {
    return null;
  }
  if (v.length > 254 || /[\r\n<>]/.test(v) || !MAIL_REPLY_TO_PATTERN.test(v)) {
    return 'Reply-To must be a valid email address.';
  }
  return null;
}

/** Empty or invalid stored values become null (platform fallback). */
export function coerceMailFromLocalPart(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v || mailFromLocalPartError(v)) {
    return null;
  }
  return v;
}

export function coerceMailFromName(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || mailFromNameError(v)) {
    return null;
  }
  return v;
}

export function coerceMailReplyTo(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || mailReplyToError(v)) {
    return null;
  }
  return v.toLowerCase();
}

export function assertFromAddressOnPlatformDomain(
  fromAddress: string,
  platformSender: string
): void {
  const platformDomain = platformDomainFromSenderAddress(platformSender);
  const fromDomain = platformDomainFromSenderAddress(fromAddress);
  if (!platformDomain || !fromDomain || fromDomain !== platformDomain) {
    throw new Error('From address must use the platform verified Resend domain.');
  }
}

export function resolveMailIdentity(
  platform: PlatformMailDefaults,
  tenant: TenantMailOverride | null | undefined
): ResolvedMailIdentity {
  const domain = platformDomainFromSenderAddress(platform.senderAddress);
  if (!domain) {
    throw new Error('MAIL_SENDER_ADDRESS is invalid.');
  }

  const fromName = coerceMailFromName(tenant?.mailFromName) || platform.fromName;
  const localPart = coerceMailFromLocalPart(tenant?.mailFromLocalPart);
  const fromAddress = localPart
    ? `${localPart}@${domain}`
    : platform.senderAddress;
  assertFromAddressOnPlatformDomain(fromAddress, platform.senderAddress);

  return {
    fromName,
    fromAddress,
    fromHeader: `${fromName} <${fromAddress}>`,
    replyTo: coerceMailReplyTo(tenant?.mailReplyTo),
    listUnsubscribeMailto: platform.senderAddress,
  };
}
