import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingSignupEmailSendError } from '../lib/billing-signup';
import { BillingSignupService } from './billing-signup.service';

describe('BillingSignupService', () => {
  const getSession = vi.fn();
  const rpc = vi.fn();
  const getSupabaseUrl = vi.fn(() => 'https://example.supabase.co');
  const getPublishableKey = vi.fn(() => 'pk_test');

  beforeEach(() => {
    vi.restoreAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    rpc.mockResolvedValue({ data: { status: 'paid_pending_setup' }, error: null });
  });

  function service(): BillingSignupService {
    return new BillingSignupService({
      client: { auth: { getSession }, rpc },
      getSupabaseUrl,
      getPublishableKey,
    } as never);
  }

  it('maps get_church_setup_state', async () => {
    const state = await service().getChurchSetupState();
    expect(rpc).toHaveBeenCalledWith('get_church_setup_state');
    expect(state.status).toBe('paid_pending_setup');
  });

  it('checks tenant slug availability via RPC', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const available = await service().isTenantSlugAvailable('new-church');
    expect(rpc).toHaveBeenCalledWith('is_tenant_slug_available', {
      p_slug: 'new-church',
    });
    expect(available).toBe(true);
  });

  it('completes church setup via RPC', async () => {
    rpc.mockResolvedValue({
      data: { id: 't1', slug: 'new-church', name: 'New Church' },
      error: null,
    });
    const tenant = await service().completeChurchSetup('New Church', 'new-church');
    expect(rpc).toHaveBeenCalledWith('complete_church_setup_for_user', {
      p_name: 'New Church',
      p_slug: 'new-church',
    });
    expect(tenant).toEqual({ id: 't1', slug: 'new-church', name: 'New Church' });
  });

  it('returns none when get_church_setup_state RPC fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const state = await service().getChurchSetupState();
    expect(state.status).toBe('none');
    errSpy.mockRestore();
  });

  it('returns null when slug availability RPC fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await service().isTenantSlugAvailable('x')).toBeNull();
    errSpy.mockRestore();
  });

  it('throws when complete church setup RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(service().completeChurchSetup('N', 'slug')).rejects.toThrow('nope');
  });

  it('throws when complete church setup returns incomplete row', async () => {
    rpc.mockResolvedValue({ data: { id: 't1' }, error: null });
    await expect(service().completeChurchSetup('N', 'slug')).rejects.toThrow(
      'Failed to finish church setup'
    );
  });

  it('rejects invalid signup kind and missing session', async () => {
    await expect(service().sendSignupEmail('invalid' as never)).rejects.toThrow(
      'Invalid signup kind'
    );
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(service().sendSignupEmail('church')).rejects.toThrow('signed in');
  });

  it('returns lead when signup email sends successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://app.example/church-setup?signup_token=tok',
          token: 'tok',
          emailed: true,
        }),
      })
    );
    const lead = await service().sendSignupEmail('church');
    expect(lead.token).toBe('tok');
    expect(lead.url).toContain('church-setup');
  });

  it('throws when signup email response is missing url or token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'bad gateway' }),
      })
    );
    await expect(service().sendSignupEmail('church')).rejects.toThrow('bad gateway');
  });

  it('churchSetupAbsoluteUrl trims trailing slashes', async () => {
    const { environment } = await import('../../environments/environment');
    const original = environment.appUrl;
    environment.appUrl = 'https://app.example///';
    expect(service().churchSetupAbsoluteUrl()).toBe('https://app.example/church-setup');
    environment.appUrl = original;
  });

  it('throws copy-link error when email send fails but url is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://app.example/church-setup?signup_token=tok',
          token: 'tok',
          emailed: false,
          error: 'Resend down',
        }),
      })
    );

    await expect(service().sendSignupEmail('church')).rejects.toBeInstanceOf(
      BillingSignupEmailSendError
    );
    try {
      await service().sendSignupEmail('church');
    } catch (error) {
      expect(error).toBeInstanceOf(BillingSignupEmailSendError);
      const sendError = error as BillingSignupEmailSendError;
      expect(sendError.url).toContain('/church-setup');
      expect(sendError.token).toBe('tok');
    }
  });
});
