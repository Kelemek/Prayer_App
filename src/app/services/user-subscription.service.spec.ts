import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserSubscriptionService } from './user-subscription.service';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';

describe('UserSubscriptionService', () => {
  let service: UserSubscriptionService;
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    service = new UserSubscriptionService(
      {
        client: { rpc },
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
  });
});
