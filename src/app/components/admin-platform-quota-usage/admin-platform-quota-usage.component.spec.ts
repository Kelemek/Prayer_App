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

  it('onExpandedChange loads once when expanded', async () => {
    const loadSpy = vi.spyOn(component, 'load').mockResolvedValue(undefined);
    component.onExpandedChange(true);
    expect(loadSpy).toHaveBeenCalled();
    loadSpy.mockClear();
    component.onExpandedChange(false);
    component.onExpandedChange(true);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('isUserMembersNear detects member quota pressure', () => {
    expect(
      component.isUserMembersNear({
        email: 'a',
        individual_plan_tier: 'pro',
        is_church_member: false,
        groups_owned: 0,
        max_groups_owned: 10,
        max_members_per_group: 10,
        largest_group_members: 9,
        recite_estimated_cost_usd: 0,
        recite_whisper_audio_seconds: 0,
      })
    ).toBe(true);
  });

  it('load stores error message on failure', async () => {
    quotaUsage.loadSnapshot.mockRejectedValue(new Error('rpc down'));
    await component.load();
    expect(component.errorMessage).toBe('rpc down');
    expect(component.snapshot).toBeNull();
  });
});
