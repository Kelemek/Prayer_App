import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migrationPath = join(
  repoRoot,
  'supabase/migrations/20260927150000_tenant_billing_guard.sql'
);
const probePath = join(
  repoRoot,
  '.cursor/skills/verify-prayer-app/artifacts/billing-guard-verify/tenant-billing-self-grant-probe.sql'
);

describe('tenant billing guard migration contract', () => {
  const sql = readFileSync(migrationPath, 'utf-8');
  const probe = readFileSync(probePath, 'utf-8');

  it('uses a filename timestamp after 20260927140000', () => {
    expect(migrationPath).toContain('20260927150000_tenant_billing_guard.sql');
  });

  it('defines a BEFORE INSERT OR UPDATE trigger on tenants', () => {
    expect(sql).toMatch(/create trigger tenants_billing_write_guard/i);
    expect(sql).toMatch(/before insert or update on public\.tenants/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = public/i);
  });

  it('bypasses only trusted database roles (not JWT claims)', () => {
    expect(sql).toContain('tenants_billing_guard_bypass');
    expect(sql).toMatch(/current_user in \('postgres', 'supabase_admin', 'service_role'\)/);
    expect(sql).not.toMatch(/request\.jwt\.claim\.role/);
  });

  it('allows only free plan_tier on direct insert', () => {
    expect(sql).toMatch(
      /NEW\.plan_tier is distinct from 'free'::public\.plan_tier/
    );
    expect(sql).toMatch(/Paid plan tiers cannot be set directly/);
    expect(sql).not.toMatch(/distinct from 'groups'::public\.plan_tier/);
  });

  it('blocks direct plan_tier and stripe column changes on update', () => {
    expect(sql).toMatch(/NEW\.plan_tier is distinct from OLD\.plan_tier/);
    expect(sql).toMatch(/NEW\.stripe_customer_id is distinct from OLD\.stripe_customer_id/);
    expect(sql).toMatch(/Tenant billing fields are managed by the platform/);
  });

  it('probe script uses begin/rollback and authenticated jwt claims', () => {
    expect(probe).toMatch(/begin;/i);
    expect(probe).toMatch(/rollback;/i);
    expect(probe).toMatch(/set local role authenticated/i);
    expect(probe).toMatch(/plan_tier.*churches/i);
    expect(probe).toMatch(/probe-groups-billing/);
    expect(probe).toMatch(/probe-free-billing/);
    expect(probe).toContain('create_tenant_for_user');
    expect(probe).toContain('apply_tenant_stripe_billing');
  });
});
