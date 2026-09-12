export type BillingSignupKind = 'church' | 'pro';

export type BillingSignupStatus =
  | 'pending'
  | 'paid_pending_setup'
  | 'consumed'
  | 'expired'
  | 'canceled';

export type ChurchSetupStatus = 'none' | 'pending' | 'paid_pending_setup' | 'attached';

export interface ChurchSetupState {
  status: ChurchSetupStatus;
  tenant_id?: string | null;
  token?: string | null;
  expires_at?: string | null;
}

export interface BillingSignupLeadCreated {
  token: string;
  url: string;
  expiresAt: string;
  status: BillingSignupStatus | string;
}

export class BillingSignupEmailSendError extends Error {
  readonly token: string;
  readonly url: string;

  constructor(message: string, token: string, url: string) {
    super(message);
    this.name = 'BillingSignupEmailSendError';
    this.token = token;
    this.url = url;
  }
}

export function isBillingSignupKind(value: unknown): value is BillingSignupKind {
  return value === 'church' || value === 'pro';
}

export function mapChurchSetupState(raw: unknown): ChurchSetupState {
  if (!raw || typeof raw !== 'object') {
    return { status: 'none' };
  }
  const row = raw as Record<string, unknown>;
  const status = row['status'];
  if (
    status !== 'none' &&
    status !== 'pending' &&
    status !== 'paid_pending_setup' &&
    status !== 'attached'
  ) {
    return { status: 'none' };
  }
  return {
    status,
    tenant_id: typeof row['tenant_id'] === 'string' ? row['tenant_id'] : null,
    token: typeof row['token'] === 'string' ? row['token'] : null,
    expires_at: typeof row['expires_at'] === 'string' ? row['expires_at'] : null,
  };
}

export function shouldRedirectHomeToChurchSetup(isNative: boolean, status: ChurchSetupStatus): boolean {
  return !isNative && status === 'paid_pending_setup';
}

export function shouldShowChurchSetupPendingBanner(
  isNative: boolean,
  status: ChurchSetupStatus
): boolean {
  return isNative && status === 'paid_pending_setup';
}

export function churchSetupWebPath(token?: string | null): string {
  const trimmed = token?.trim() ?? '';
  if (!trimmed) {
    return '/church-setup';
  }
  return `/church-setup?signup_token=${encodeURIComponent(trimmed)}`;
}

export function proSignupWebPath(token: string): string {
  return `/?pro_signup_token=${encodeURIComponent(token.trim())}`;
}

export function buildBillingSignupWebUrl(appOrigin: string, kind: BillingSignupKind, token: string): string {
  const base = appOrigin.replace(/\/+$/, '');
  if (kind === 'church') {
    return `${base}${churchSetupWebPath(token)}`;
  }
  return `${base}${proSignupWebPath(token)}`;
}

export function payFirstTourLastStepMode(isNative: boolean): 'email' | 'pay' {
  return isNative ? 'email' : 'pay';
}

export function payFirstTourDoneButtonText(isNative: boolean): string {
  return isNative ? 'Email me a link to set up' : 'Continue';
}

export type ChurchCheckoutWebhookAction =
  | 'apply_tenant_billing'
  | 'mark_paid_pending_setup'
  | 'ignore';

/** Church Checkout webhook: no tenant_id means pay-first lead, not a tenant yet. */
export function churchCheckoutCompletedAction(
  kind: string,
  tenantId: string | null | undefined
): ChurchCheckoutWebhookAction {
  if (kind !== 'church') {
    return 'ignore';
  }
  return tenantId?.trim() ? 'apply_tenant_billing' : 'mark_paid_pending_setup';
}
