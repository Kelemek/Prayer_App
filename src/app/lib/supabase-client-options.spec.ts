import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase-auth-storage', () => ({
  resolveSupabaseAuthClientOptions: vi.fn(() => ({
    storage: {},
    storageKey: 'sb-key',
  })),
}));

import { buildSupabaseClientOptions } from './supabase-client-options';

describe('buildSupabaseClientOptions', () => {
  it('builds client options with auth, fetch, and realtime', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    const options = buildSupabaseClientOptions(
      'https://example.supabase.co',
      () => '2.0.0',
      fetchFn
    );
    expect(options.auth?.storageKey).toBe('sb-key');
    expect(options.global?.headers?.['x-client-info']).toContain('2.0.0');
    await options.global?.fetch?.('https://example.com', {});
    expect(fetchFn).toHaveBeenCalled();
    const lock = options.auth?.lock;
    expect(await lock?.('x', 0, async () => 42)).toBe(42);
  });
});
