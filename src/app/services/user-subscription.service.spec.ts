import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserSubscriptionService } from './user-subscription.service';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';

describe('UserSubscriptionService', () => {
  let service: UserSubscriptionService;
  const rpc = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { stripe_customer_id: 'cus_123' },
            error: null,
          }),
        }),
      }),
    });
    service = new UserSubscriptionService(
      {
        client: { rpc, from },
      } as unknown as SupabaseService,
      {
        getEmail: vi.fn().mockResolvedValue('user@example.com'),
      } as unknown as AuthIdentityService
    );
  });

  it('refreshCapabilities loads group limits and practice modes', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'get_user_group_limits') {
        return Promise.resolve({
          data: {
            individual_plan_tier: 'free',
            is_church_member: false,
            max_groups_owned: 1,
            max_members_per_group: 5,
            groups_owned: 0,
            can_create_group: true,
          },
          error: null,
        });
      }
      if (name === 'get_user_memorization_practice_modes') {
        return Promise.resolve({
          data: {
            individual_plan_tier: 'free',
            is_church_member: false,
            practice_modes: ['type', 'word'],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await service.refreshCapabilities();

    expect(service.getGroupLimits().can_create_group).toBe(true);
    expect(service.isPracticeModeAllowed('type')).toBe(true);
    expect(service.isPracticeModeAllowed('recite')).toBe(false);
    expect(service.hasProBillingPortal()).toBe(true);
  });

  it('refreshCapabilities resets when email is missing', async () => {
    const noEmail = new UserSubscriptionService(
      { client: { rpc, from } } as unknown as SupabaseService,
      { getEmail: vi.fn().mockResolvedValue(null) } as unknown as AuthIdentityService
    );
    await noEmail.refreshCapabilities();
    expect(noEmail.hasProBillingPortal()).toBe(false);
    expect(noEmail.getPracticeModes()).toContain('type');
  });

  it('registerFreeUser upserts and refreshes', async () => {
    rpc.mockResolvedValue({ error: null });
    rpc.mockImplementation((name: string) => {
      if (name === 'upsert_user_subscription_free') {
        return Promise.resolve({ error: null });
      }
      if (name === 'get_user_group_limits') {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === 'get_user_memorization_practice_modes') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    await expect(service.registerFreeUser('User')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('upsert_user_subscription_free', expect.any(Object));
  });
});
