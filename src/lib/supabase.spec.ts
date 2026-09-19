import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock the @supabase/supabase-js module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key) => ({
    _url: url,
    _key: key,
    auth: {},
    from: vi.fn(),
  })),
}));

// Mock the environment
vi.mock('../environments/environment', () => ({
  environment: {
    production: false,
    supabaseUrl: 'https://test.supabase.co',
    supabasePublishableKey: 'test-publishable-key',
    appUrl: '',
    platformHosts: ['localhost'],
    cookieParentDomain: '',
    tenantHostSuffix: '',
  },
}));

describe('supabase', () => {
  let lockFn: (
    name: string,
    timeout: number,
    fn: () => Promise<unknown>
  ) => Promise<unknown>;
  let createClientCall: unknown[];

  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    await import('./supabase');
    createClientCall = [...vi.mocked(createClient).mock.calls[0]];
    const options = createClientCall[2] as { auth: { lock: typeof lockFn } };
    lockFn = options.auth.lock;
  });

  it('should create and export a supabase client', async () => {
    const { supabase } = await import('./supabase');

    expect(createClientCall[0]).toBe('https://test.supabase.co');
    expect(createClientCall[1]).toBe('test-publishable-key');
    expect(createClientCall[2]).toEqual(
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          lock: expect.any(Function),
        }),
      })
    );

    expect(supabase).toBeDefined();
    expect(supabase).toHaveProperty('_url', 'https://test.supabase.co');
    expect(supabase).toHaveProperty('_key', 'test-publishable-key');
  });

  it('should execute lock function without acquiring locks', async () => {
    const mockFn = vi.fn(async () => 'test-result');
    const result = await lockFn('test-lock', 5000, mockFn);

    expect(result).toBe('test-result');
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should handle lock function with async operations', async () => {
    const testValue = { data: 'value' };
    const asyncFn = vi.fn(async () => testValue);
    const result = await lockFn('another-lock', 3000, asyncFn);

    expect(result).toEqual(testValue);
    expect(asyncFn).toHaveBeenCalledOnce();
  });

  it('should pass through function errors from lock callback', async () => {
    const testError = new Error('Lock operation failed');
    const errorFn = vi.fn(async () => {
      throw testError;
    });

    await expect(lockFn('error-lock', 1000, errorFn)).rejects.toThrow(
      'Lock operation failed'
    );
    expect(errorFn).toHaveBeenCalledOnce();
  });
});
