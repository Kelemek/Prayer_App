import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migrationPath = join(
  repoRoot,
  'supabase/migrations/20260927130000_close_signed_in_personal_rls.sql'
);

describe('close-signed-in-personal-rls migration contract', () => {
  const sql = readFileSync(migrationPath, 'utf-8');

  const policyDrops = [
    'Authenticated users can delete personal prayers',
    'Authenticated users can insert personal prayers',
    'Authenticated users can select personal prayers',
    'Authenticated users can update personal prayers',
    'Users can delete their own personal prayers',
    'Users can insert their own personal prayers',
    'Users can update their own personal prayers',
    'Users can see their own personal prayers',
    'Allow all personal_prayers access',
    'Allow all personal_prayer_updates access',
    'Authenticated users can select personal prayer updates',
    'Authenticated users can insert personal prayer updates',
    'Authenticated users can update personal prayer updates',
    'Authenticated users can delete personal prayer updates',
    'Allow all deletes',
    'Allow all inserts',
    'Allow all updates',
    'Allow public reads',
    'Anyone can read backup logs',
    'Service role can insert backup logs',
    'admin_settings_select_authenticated',
  ];

  it('drops every legacy permissive policy by name', () => {
    for (const name of policyDrops) {
      expect(sql).toContain(`drop policy if exists ${name.includes(' ') ? `"${name}"` : name}`);
    }
  });

  it('revokes anon/public on the four affected tables', () => {
    expect(sql).toContain('revoke all on table public.personal_prayers from public, anon');
    expect(sql).toContain('revoke all on table public.personal_prayer_updates from public, anon');
    expect(sql).toContain('revoke all on table public.backup_logs from public, anon');
    expect(sql).toContain('revoke all on table public.admin_settings from public, anon');
  });

  it('does not reintroduce anon or unconditional permissive policies', () => {
    const ddlLines = sql
      .split('\n')
      .map((line) => line.replace(/--.*$/, '').trim())
      .filter((line) => line.length > 0);
    const ddl = ddlLines.join('\n');
    expect(ddl).not.toMatch(/\bto anon\b/i);
    expect(ddl).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(ddl).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it('drops github_token and defines broadcast exclusion RPC safely', () => {
    expect(sql).toContain('drop column if exists github_token');
    expect(sql).toContain('get_broadcast_excluded_test_account_email');
    expect(sql).toContain('security definer');
    expect(sql).toContain(
      'grant execute on function public.get_broadcast_excluded_test_account_email() to authenticated'
    );
    const fnBody = sql.match(
      /create or replace function public\.get_broadcast_excluded_test_account_email\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/i
    )?.[1];
    expect(fnBody).toBeTruthy();
    expect(fnBody!).not.toMatch(/test_account_code/i);
  });
});
