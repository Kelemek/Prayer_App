import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('pay-first billing contracts', () => {
  it('webhook without tenant_id marks church leads paid_pending_setup', () => {
    const webhook = readFileSync(
      join(repoRoot, 'supabase/functions/stripe-webhook/index.ts'),
      'utf-8'
    );
    expect(webhook).toContain("if (kind === 'church')");
    expect(webhook).toContain('session.metadata?.tenant_id');
    expect(webhook).toContain('markChurchSignupPaid');
    expect(webhook).toContain("status: 'paid_pending_setup'");
    expect(webhook).not.toMatch(/insert into public\.tenants[\s\S]*kind === 'church'/);
  });

  it('complete_church_setup_for_user creates an active church tenant, attaches Stripe IDs, and consumes the lead', () => {
    const sql = readFileSync(
      join(repoRoot, 'supabase/migrations/20260911120000_billing_signup_pay_first.sql'),
      'utf-8'
    );
    expect(sql).toContain('complete_church_setup_for_user');
    expect(sql).toContain("plan_tier, plan_status");
    expect(sql).toContain("'churches'");
    expect(sql).toContain("'active'");
    expect(sql).toContain('apply_tenant_stripe_billing');
    expect(sql).toContain('v_lead.stripe_customer_id');
    expect(sql).toContain('v_lead.stripe_subscription_id');
    expect(sql).toContain("status = 'consumed'");
    expect(sql).toContain("raise exception 'Slug taken'");
    expect(sql).toContain(
      "raise exception 'Church tenants are created after payment via complete_church_setup_for_user'"
    );
  });
});
