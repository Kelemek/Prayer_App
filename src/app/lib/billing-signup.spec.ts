import { describe, it, expect } from 'vitest';
import {
  buildBillingSignupWebUrl,
  churchCheckoutCompletedAction,
  churchSetupWebPath,
  mapChurchSetupState,
  payFirstTourDoneButtonText,
  payFirstTourLastStepMode,
  shouldRedirectHomeToChurchSetup,
  shouldShowChurchSetupPendingBanner,
} from './billing-signup';

describe('billing-signup helpers', () => {
  it('maps church setup state and ignores unknown status', () => {
    expect(mapChurchSetupState(null).status).toBe('none');
    expect(
      mapChurchSetupState({ status: 'paid_pending_setup', token: 'abc' }).status
    ).toBe('paid_pending_setup');
    expect(mapChurchSetupState({ status: 'nope' }).status).toBe('none');
  });

  it('redirects web home to wizard only when paid and pending setup', () => {
    expect(shouldRedirectHomeToChurchSetup(false, 'paid_pending_setup')).toBe(true);
    expect(shouldRedirectHomeToChurchSetup(true, 'paid_pending_setup')).toBe(false);
    expect(shouldRedirectHomeToChurchSetup(false, 'pending')).toBe(false);
  });

  it('shows native pending banner only when paid and pending setup', () => {
    expect(shouldShowChurchSetupPendingBanner(true, 'paid_pending_setup')).toBe(true);
    expect(shouldShowChurchSetupPendingBanner(false, 'paid_pending_setup')).toBe(false);
  });

  it('branches last-step CTA without prices', () => {
    expect(payFirstTourLastStepMode(true)).toBe('email');
    expect(payFirstTourLastStepMode(false)).toBe('pay');
    expect(payFirstTourDoneButtonText(true)).toBe('Email me a link to set up');
    expect(payFirstTourDoneButtonText(false)).toBe('Continue');
    expect(payFirstTourDoneButtonText(true)).not.toMatch(/\$|Buy|Stripe|checkout/i);
  });

  it('routes church checkout webhooks without tenant_id to paid_pending_setup', () => {
    expect(churchCheckoutCompletedAction('church', null)).toBe('mark_paid_pending_setup');
    expect(churchCheckoutCompletedAction('church', '')).toBe('mark_paid_pending_setup');
    expect(churchCheckoutCompletedAction('church', 'tenant-1')).toBe('apply_tenant_billing');
    expect(churchCheckoutCompletedAction('pro', null)).toBe('ignore');
  });

  it('builds platform web URLs for email links', () => {
    expect(churchSetupWebPath('tok')).toBe('/church-setup?signup_token=tok');
    expect(buildBillingSignupWebUrl('https://app.example', 'church', 'tok')).toBe(
      'https://app.example/church-setup?signup_token=tok'
    );
    expect(buildBillingSignupWebUrl('https://app.example/', 'pro', 'tok')).toBe(
      'https://app.example/?pro_signup_token=tok'
    );
  });
});
