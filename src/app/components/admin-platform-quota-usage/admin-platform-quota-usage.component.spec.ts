import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminPlatformQuotaUsageComponent } from './admin-platform-quota-usage.component';
import { PlatformQuotaUsageService } from '../../services/platform-quota-usage.service';

describe('AdminPlatformQuotaUsageComponent', () => {
  const quotaUsage = {
    loadSnapshot: vi.fn(),
  };
  let component: AdminPlatformQuotaUsageComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    component = new AdminPlatformQuotaUsageComponent(
      quotaUsage as unknown as PlatformQuotaUsageService,
      { markForCheck: vi.fn() } as never
    );
  });

  it('renders mocked user rows after load', async () => {
    quotaUsage.loadSnapshot.mockResolvedValue({
      users: [
        {
          email: 'pro@example.com',
          individual_plan_tier: 'pro',
          is_church_member: false,
          groups_owned: 8,
          max_groups_owned: 10,
          max_members_per_group: 25,
          largest_group_members: 3,
          recite_estimated_cost_usd: 0.12,
          recite_whisper_audio_seconds: 30,
        },
      ],
      tenants: [],
    });
    await component.load();
    expect(component.snapshot?.users).toHaveLength(1);
    expect(component.isUserGroupsNear(component.snapshot!.users[0])).toBe(true);
  });

  it('flags migration missing when RPC is absent', async () => {
    quotaUsage.loadSnapshot.mockResolvedValue(null);
    await component.load();
    expect(component.migrationMissing).toBe(true);
  });
});
