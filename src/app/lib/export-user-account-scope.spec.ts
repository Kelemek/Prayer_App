import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findExportScopeLeaks,
  isExportUserAccountPayload,
} from './export-user-account-scope';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'me@example.com',
};

function scopedExport() {
  return {
    schema_version: 1,
    exported_at: '2026-09-19T00:00:00.000Z',
    scope: { auth_user_id: USER.id, email: USER.email },
    account: { auth_user_id: USER.id, email: USER.email },
    memberships: [
      {
        tenant_id: 'tenant-a',
        tenant_name: 'Church A',
        user_email: USER.email,
        auth_user_id: USER.id,
        role: 'member',
      },
      {
        tenant_id: 'tenant-b',
        tenant_name: 'Church B',
        user_email: 'Me@Example.com',
        auth_user_id: USER.id,
        role: 'tenant_admin',
      },
    ],
    preferences: {
      membership_preferences: [{ tenant_id: 'tenant-a', user_email: USER.email }],
      personal_categories: [{ name: 'Family', user_email: USER.email }],
    },
    prayers: {
      church_prayers: [{ email: USER.email, title: 'Mine' }],
      personal_prayers: [{ user_email: USER.email, title: 'Private' }],
      group_prayers: [{ email: USER.email }],
      church_prayer_updates: [{ author_email: USER.email }],
    },
  };
}

describe('export-user-account-scope', () => {
  it('accepts a version-1 package with account, memberships, prefs, and prayers', () => {
    expect(isExportUserAccountPayload(scopedExport())).toBe(true);
  });

  it('rejects a package missing required sections', () => {
    expect(isExportUserAccountPayload({ schema_version: 1 })).toBe(false);
    expect(isExportUserAccountPayload(null)).toBe(false);
  });

  it('finds no leaks when every identity field is the caller, including two tenants', () => {
    expect(findExportScopeLeaks(scopedExport(), USER)).toEqual([]);
  });

  it('flags another user email on a prayer row', () => {
    const payload = scopedExport();
    (payload.prayers.church_prayers as Array<Record<string, string>>).push({
      email: 'other@example.com',
      title: 'Not mine',
    });

    const leaks = findExportScopeLeaks(payload, USER);
    expect(leaks.some((leak) => leak.value === 'other@example.com')).toBe(true);
  });

  it('flags another auth user id on a membership', () => {
    const payload = scopedExport();
    payload.memberships[0] = {
      ...payload.memberships[0],
      auth_user_id: '22222222-2222-2222-2222-222222222222',
    };

    const leaks = findExportScopeLeaks(payload, USER);
    expect(leaks.some((leak) => leak.key === 'auth_user_id')).toBe(true);
  });

  it('does not treat invited_by_email as a leak key', () => {
    const payload = scopedExport();
    (payload as Record<string, unknown>)['other'] = {
      tenant_invites: [
        { email: USER.email, invited_by_email: 'admin@church.example' },
      ],
    };

    expect(findExportScopeLeaks(payload, USER)).toEqual([]);
  });
});

describe('export_user_account migration contract', () => {
  const sql = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../supabase/migrations/20260923120000_export_user_account.sql'
    ),
    'utf8'
  );

  it('exposes a no-argument RPC bound to auth.uid()', () => {
    expect(sql).toMatch(/create or replace function public\.export_user_account\(\)/);
    expect(sql).toContain('v_user_id uuid := auth.uid()');
    expect(sql).toContain('raise exception \'not authenticated\'');
    expect(sql).not.toMatch(/p_user_id/);
    expect(sql).not.toMatch(/p_email/);
  });

  it('is not executable by anonymous clients', () => {
    expect(sql).toMatch(/revoke all on function public\.export_user_account\(\) from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.export_user_account\(\) to authenticated/);
  });

  it('scopes memberships and authored prayers to the caller across tenants', () => {
    expect(sql).toContain('m.auth_user_id = v_user_id');
    expect(sql).toContain('lower(trim(m.user_email)) = v_email');
    expect(sql).toContain('lower(trim(p.email::text)) = v_email');
    expect(sql).toContain('lower(trim(p.user_email)) = v_email');
  });
});
