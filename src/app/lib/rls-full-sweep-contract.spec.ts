import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migrationPath = join(
  repoRoot,
  'supabase/migrations/20260927140000_rls_full_sweep.sql'
);

describe('rls-full-sweep migration contract', () => {
  const sql = readFileSync(migrationPath, 'utf-8');

  const policyDrops = [
    '"Anyone can view deletion requests"',
    '"Anyone can submit deletion requests"',
    '"Only authenticated users can update deletion requests"',
    '"Only authenticated users can delete deletion requests"',
    '"Admins can manage deletion_requests"',
    '"Anyone can enqueue emails"',
    '"Service role can process queue"',
    'member_prayer_updates_select_authenticated',
    'member_prayer_updates_insert_authenticated',
    'member_prayer_updates_update_authenticated',
    'member_prayer_updates_delete_authenticated',
    'member_prayed_for_counts_select_authenticated',
    'tenant_insert_prayers_membership_by_row_email',
    'tenant_update_prayers',
    'tenant_update_prayer_updates',
  ];

  it('uses a filename timestamp after 20260927130000', () => {
    expect(migrationPath).toContain('20260927140000_rls_full_sweep.sql');
  });

  it('drops every legacy policy by name', () => {
    for (const name of policyDrops) {
      expect(sql).toContain(`drop policy if exists ${name}`);
    }
  });

  it('has no unconditional permissive policies in DDL', () => {
    const ddlLines = sql
      .split('\n')
      .map((line) => line.replace(/--.*$/, '').trim())
      .filter((line) => line.length > 0);
    const ddl = ddlLines.join('\n');
    expect(ddl).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(ddl).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it('revokes anon table access except ibcd catalogs', () => {
    expect(sql).toContain('revoke all on all tables in schema public from anon');
    expect(sql).toContain(
      'grant select on table public.ibcd_memorization_catalog_categories to anon'
    );
    expect(sql).toContain(
      'grant select on table public.ibcd_memorization_catalog_verses to anon'
    );
    const anonGrants = sql.match(/grant\s+[^;]+\s+to anon/gi) ?? [];
    expect(anonGrants.every((g) => g.includes('ibcd_memorization_catalog'))).toBe(true);
  });

  it('revokes truncate for authenticated', () => {
    expect(sql).toContain('revoke truncate on all tables in schema public from authenticated');
  });

  it('revokes service-only RPCs from public, anon, authenticated', () => {
    const serviceOnly = [
      'apply_tenant_stripe_billing',
      'downgrade_church_tenant_after_access_end',
      'list_church_tenants_due_for_billing_downgrade',
      'get_user_prayer_hour_reminders_due_now',
      'get_user_memorization_hour_reminders_due_now',
      'get_user_prayer_item_reminders_due_now',
      '_merge_ibcd_memorization_catalog',
      'seed_ibcd_memorization_recommendations',
      'get_tenant_context_by_email',
    ];
    for (const fn of serviceOnly) {
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public, anon, authenticated`, 'i')
      );
    }
  });

  it('does not trust caller-supplied email in rewritten RPCs', () => {
    expect(sql).not.toContain('v_email := v_p_email');
    expect(sql).not.toContain('gr.user_email = v_email');
    const settingsFns = [
      'get_tenant_mail_identity',
      'update_tenant_mail_identity',
      'get_tenant_branding_settings',
      'update_tenant_branding_settings',
      'get_tenant_reminder_settings',
      'update_tenant_reminder_settings',
      'get_tenant_prayer_encouragement_settings',
      'update_tenant_prayer_encouragement_settings',
      'get_tenant_memorization_recite_settings',
      'update_tenant_memorization_recite_settings',
      'get_tenant_memorization_recite_usage_summary',
      'ensure_tenant_email_templates',
      'ensure_tenant_prayer_types',
      'create_tenant_for_user',
    ];
    for (const fn of settingsFns) {
      expect(sql).toMatch(
        new RegExp(
          `function public\\.${fn}[\\s\\S]*?v_p_email != '' and v_p_email != v_email`,
          'i'
        )
      );
    }
    const superAdminFns = [
      'list_approved_prayers_for_super_admin',
      'list_approved_prayer_updates_for_super_admin',
      'list_super_admins_for_caller',
      'get_all_tenants_for_email',
    ];
    for (const fn of superAdminFns) {
      expect(sql).toMatch(
        new RegExp(`function public\\.${fn}[\\s\\S]*?public\\.is_super_admin\\(v_caller\\)`, 'i')
      );
    }
  });

  it('replaces member prayed-for increment RPC with tenant-scoped overload', () => {
    expect(sql).toContain('drop function if exists public.increment_member_prayed_for_count(text)');
    expect(sql).toMatch(
      /create or replace function public\.increment_member_prayed_for_count\(\s*\n\s*p_tenant_id uuid,\s*\n\s*p_person_id text\s*\)/i
    );
  });

  it('restricts member email_queue templates', () => {
    expect(sql).toContain(
      "'group_prayer_added', 'group_prayer_update', 'prayer_answered'"
    );
  });

  it('does not alter personal-prayer admin visibility policies', () => {
    const ddl = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(ddl).not.toContain('drop policy if exists "Admins can see all personal prayers"');
    expect(ddl).not.toMatch(/create policy[^;]*"Admins can see all personal prayers"/i);
  });
});
