import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantPermissionService } from './tenant-permission.service';
import { TenantContextService } from './tenant-context.service';
import { PrayerGroupService } from './prayer-group.service';
import { UserSubscriptionService } from './user-subscription.service';

describe('TenantPermissionService', () => {
  let service: TenantPermissionService;
  let tenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    getIsSuperAdmin: ReturnType<typeof vi.fn>;
    getMemberships: ReturnType<typeof vi.fn>;
  };
  let prayerGroupService: {
    canCreatePrayerGroups: ReturnType<typeof vi.fn>;
    canAccessGroupsTab: ReturnType<typeof vi.fn>;
  };
  let userSubscriptionService: {
    getGroupLimits: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tenantContext = {
      getActiveTenant: vi.fn(() => ({
        id: 'tenant-1',
        name: 'Test Church',
        plan_tier: 'churches',
      })),
      getIsSuperAdmin: vi.fn(() => false),
      getMemberships: vi.fn(() => [
        { tenant_id: 'tenant-1', role: 'tenant_admin' },
      ]),
    };
    prayerGroupService = {
      canCreatePrayerGroups: vi.fn(() => false),
      canAccessGroupsTab: vi.fn(() => false),
    };
    userSubscriptionService = {
      getGroupLimits: vi.fn(() => ({
        individual_plan_tier: 'free',
        is_church_member: false,
        max_groups_owned: 1,
        max_members_per_group: 5,
        groups_owned: 0,
        can_create_group: true,
      })),
    };
    service = new TenantPermissionService(
      tenantContext as unknown as TenantContextService,
      prayerGroupService as unknown as PrayerGroupService,
      userSubscriptionService as unknown as UserSubscriptionService
    );
  });

  it('allows shared access for churches plan only', () => {
    expect(service.canAccessShared()).toBe(true);
    expect(service.canAccessPresentation()).toBe(true);
    expect(service.isPersonalOnlyUser()).toBe(false);
  });

  it('denies shared access for groups and free plans', () => {
    tenantContext.getActiveTenant.mockReturnValue({
      id: 'tenant-1',
      name: 'Groups Org',
      plan_tier: 'groups',
    });
    expect(service.canAccessShared()).toBe(false);

    tenantContext.getActiveTenant.mockReturnValue({
      id: 'tenant-1',
      name: 'Free',
      plan_tier: 'free',
    });
    expect(service.canAccessShared()).toBe(false);
    expect(service.isPersonalOnlyUser()).toBe(true);
  });

  it('grants admin access to churches tenant admins and super admins', () => {
    expect(service.canAccessAdmin()).toBe(true);
    expect(service.canManageTenant()).toBe(true);

    tenantContext.getMemberships.mockReturnValue([
      { tenant_id: 'tenant-1', role: 'member' },
    ]);
    expect(service.canAccessAdmin()).toBe(false);

    tenantContext.getIsSuperAdmin.mockReturnValue(true);
    expect(service.canAccessAdmin()).toBe(true);
  });

  it('denies admin for non-churches tenants even for tenant_admin', () => {
    tenantContext.getActiveTenant.mockReturnValue({
      id: 'tenant-1',
      name: 'Groups Org',
      plan_tier: 'groups',
    });
    expect(service.canAccessAdmin()).toBe(false);
  });

  it('always shows Groups tab and uses subscription limits for create', () => {
    expect(service.canAccessGroupsTab()).toBe(true);

    userSubscriptionService.getGroupLimits.mockReturnValue({
      can_create_group: false,
    });
    expect(service.canCreatePrayerGroups()).toBe(false);

    prayerGroupService.canCreatePrayerGroups.mockReturnValue(true);
    expect(service.canCreatePrayerGroups()).toBe(true);
  });
});
