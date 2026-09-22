import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import {
  downloadJsonFile,
  exportUserAccountFilename,
  isExportUserAccountPayload,
  runUserSettingsDownloadMyData,
  saveAccountExport,
} from './user-settings-export-run';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

function makeHost(rpcImpl: () => Promise<{ data: unknown; error: unknown }>) {
  return {
    exportingAccount: false,
    pendingAccountExport: null as { filename: string; data: unknown } | null,
    error: null as string | null,
    markForCheck: vi.fn(),
    deps: {
      supabase: {
        client: {
          rpc: vi.fn(rpcImpl),
        },
      },
    },
  };
}

const validPayload = {
  schema_version: 1,
  account: { auth_user_id: 'u1', email: 'me@example.com' },
  memberships: [],
  preferences: {},
  prayers: {},
};

describe('isExportUserAccountPayload', () => {
  it('accepts a version-1 package with the required sections', () => {
    expect(isExportUserAccountPayload(validPayload)).toBe(true);
  });

  it('rejects null section objects and incomplete bodies', () => {
    expect(isExportUserAccountPayload(null)).toBe(false);
    expect(isExportUserAccountPayload({ schema_version: 1 })).toBe(false);
    expect(
      isExportUserAccountPayload({
        ...validPayload,
        memberships: null,
      })
    ).toBe(false);
  });
});

describe('user-settings-export-run', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
  });

  it('names the file with an ISO date', () => {
    expect(exportUserAccountFilename(new Date('2026-09-19T15:04:05.000Z'))).toBe(
      'prayer-app-data-export-2026-09-19.json'
    );
  });

  it('invokes export_user_account and downloads JSON', async () => {
    const host = makeHost(async () => ({ data: validPayload, error: null }));
    const download = vi.fn();

    await runUserSettingsDownloadMyData(host as never, download);

    expect(host.deps.supabase.client.rpc).toHaveBeenCalledWith('export_user_account');
    expect(download).toHaveBeenCalledWith(
      expect.stringMatching(/^prayer-app-data-export-\d{4}-\d{2}-\d{2}\.json$/),
      validPayload
    );
    expect(host.exportingAccount).toBe(false);
    expect(host.error).toBeNull();
  });

  it('sets an error and does not download when the RPC fails', async () => {
    const host = makeHost(async () => ({
      data: null,
      error: { message: 'not authenticated' },
    }));
    const download = vi.fn();

    await runUserSettingsDownloadMyData(host as never, download);

    expect(download).not.toHaveBeenCalled();
    expect(host.error).toBe('not authenticated');
    expect(host.exportingAccount).toBe(false);
  });

  it('rejects a body missing the version-1 sections', async () => {
    const host = makeHost(async () => ({
      data: { prayers: [{ email: 'other@example.com' }] },
      error: null,
    }));
    const download = vi.fn();

    await runUserSettingsDownloadMyData(host as never, download);

    expect(download).not.toHaveBeenCalled();
    expect(host.error).toMatch(/Could not export your data/);
  });

  it('does not start a second export while one is in flight', async () => {
    const host = makeHost(async () => ({ data: validPayload, error: null }));
    host.exportingAccount = true;
    const download = vi.fn();

    await runUserSettingsDownloadMyData(host as never, download);

    expect(host.deps.supabase.client.rpc).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it('creates an object URL for a JSON download', () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:export');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = click;
      }
      return el;
    });

    downloadJsonFile('prayer-app-data-export-2026-09-19.json', { ok: true });

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('keeps the export ready when iOS will not open the save sheet yet', async () => {
    const host = makeHost(async () => ({ data: validPayload, error: null }));
    const deliver = vi.fn(async () => 'needs-gesture' as const);

    await runUserSettingsDownloadMyData(host as never, deliver);

    expect(host.pendingAccountExport?.filename).toMatch(
      /^prayer-app-data-export-\d{4}-\d{2}-\d{2}\.json$/
    );
    expect(host.pendingAccountExport?.data).toEqual(validPayload);
    expect(host.error).toBeNull();

    deliver.mockResolvedValueOnce('saved');
    await runUserSettingsDownloadMyData(host as never, deliver);

    expect(host.deps.supabase.client.rpc).toHaveBeenCalledTimes(1);
    expect(host.pendingAccountExport).toBeNull();
  });

  it('opens the native share sheet for an iOS export', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });

    const result = await saveAccountExport('prayer-app-data-export-2026-09-21.json', {
      ok: true,
    });

    expect(result).toBe('saved');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'prayer-app-data-export-2026-09-21.json',
        files: [expect.any(File)],
      })
    );
  });

  it('asks for another tap when iOS blocks the share sheet after the export request', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('gesture', 'NotAllowedError'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });

    await expect(
      saveAccountExport('prayer-app-data-export-2026-09-21.json', { ok: true })
    ).resolves.toBe('needs-gesture');
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
    expect(sql).toContain("raise exception 'not authenticated'");
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

  it('names every erase_user_account target table as exported or omitted', () => {
    const eraseTargets = [
      'tenant_memberships',
      'prayers',
      'prayer_updates',
      'personal_prayers',
      'personal_prayer_updates',
      'group_prayers',
      'group_prayer_updates',
      'prayer_group_members',
      'prayer_groups',
      'personal_categories',
      'device_tokens',
      'push_notification_log',
      'billing_signup_leads',
      'user_subscriptions',
      'account_approval_requests',
      'tenant_invites',
      'email_queue',
      'global_roles',
      'memorized_items',
      'memorization_recite_usage',
      'user_memorization_hour_reminders',
      'user_prayer_hour_reminders',
      'user_prayer_item_reminders',
      'prompt_prayed_for_counts',
      'badge_read_receipts',
      'analytics',
      'tenants',
      'feedback_submissions',
      'deletion_requests',
      'update_deletion_requests',
      'verification_codes',
      'personal_prayer_category_colors',
      'status_change_requests',
    ];

    for (const table of eraseTargets) {
      expect(sql, table).toContain(table);
    }
  });
});
