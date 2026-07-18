import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantPermissionService } from './tenant-permission.service';
import { TenantContextService } from './tenant-context.service';

describe('TenantPermissionService', () => {
  let service: TenantPermissionService;
  let tenantContext: {
    getActiveTenant: ReturnType<typeof vi.fn>;
    getIsSuperAdmin: ReturnType<typeof vi.fn>;
    getMemberships: ReturnType<typeof vi.fn>;
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
    service = new TenantPermissionService(tenantContext as unknown as TenantContextService);
  });

  it('allows shared access for groups/churches plans', () => {
    expect(service.canAccessShared()).toBe(true);
    expect(service.canAccessPresentation()).toBe(true);
    expect(service.isPersonalOnlyUser()).toBe(false);
  });

  it('denies shared access for personal plan', () => {
    tenantContext.getActiveTenant.mockReturnValue({
      id: 'tenant-1',
      name: 'Personal',
      plan_tier: 'personal',
    });
    expect(service.canAccessShared()).toBe(false);
    expect(service.isPersonalOnlyUser()).toBe(true);
  });

  it('grants admin access to tenant admins and super admins', () => {
    expect(service.canAccessAdmin()).toBe(true);
    expect(service.canManageTenant()).toBe(true);

    tenantContext.getMemberships.mockReturnValue([
      { tenant_id: 'tenant-1', role: 'member' },
    ]);
    expect(service.canAccessAdmin()).toBe(false);

    tenantContext.getIsSuperAdmin.mockReturnValue(true);
    expect(service.canAccessAdmin()).toBe(true);
  });
});
