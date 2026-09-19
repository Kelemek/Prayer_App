import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  downloadJsonFile,
  exportUserAccountFilename,
  runUserSettingsDownloadMyData,
} from './user-settings-export-run';

function makeHost(rpcImpl: () => Promise<{ data: unknown; error: unknown }>) {
  return {
    exportingAccount: false,
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

describe('user-settings-export-run', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('rejects a payload that is not a scoped export package', async () => {
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
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
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
});
