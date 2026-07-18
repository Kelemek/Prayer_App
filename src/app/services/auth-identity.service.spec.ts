import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthIdentityService } from './auth-identity.service';
import { SupabaseService } from './supabase.service';

describe('AuthIdentityService', () => {
  let service: AuthIdentityService;
  let getSession: ReturnType<typeof vi.fn>;
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    getSession = vi.fn();
    rpc = vi.fn();
    service = new AuthIdentityService({
      client: { auth: { getSession }, rpc },
    } as unknown as SupabaseService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns normalized session email', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: ' User@Example.com ' } } },
    });
    await expect(service.getEmail()).resolves.toBe('user@example.com');
  });

  it('returns null when session lookup fails', async () => {
    getSession.mockRejectedValue(new Error('offline'));
    await expect(service.getEmail()).resolves.toBeNull();
  });

  it('stores and clears pending login state', () => {
    service.setPendingLogin('Admin@Example.com', true);
    expect(service.getPendingLoginEmail()).toBe('admin@example.com');
    expect(service.isPendingTestAccountLogin()).toBe(true);

    service.setPendingLogin('user@example.com');
    expect(service.isPendingTestAccountLogin()).toBe(false);

    service.clearPendingLogin();
    expect(service.getPendingLoginEmail()).toBeNull();
    expect(service.isPendingTestAccountLogin()).toBe(false);
  });

  it('checks test account emails via RPC', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(service.isTestAccountEmail('test@example.com')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_test_account_email', {
      p_email: 'test@example.com',
    });
  });

  it('returns false for blank or failed test-account lookups', async () => {
    await expect(service.isTestAccountEmail('   ')).resolves.toBe(false);
    rpc.mockResolvedValue({ data: true, error: { message: 'fail' } });
    await expect(service.isTestAccountEmail('test@example.com')).resolves.toBe(false);
  });
});
