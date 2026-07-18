import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { TenantManagementComponent } from './tenant-management.component';
import type { Tenant } from '../../types/tenant';

const tenantA: Tenant = {
  id: 'tenant-a',
  name: 'Alpha Church',
  slug: 'alpha-church',
  plan_tier: 'groups',
  plan_status: 'active',
};

const tenantB: Tenant = {
  id: 'tenant-b',
  name: 'Beta Group',
  slug: 'beta-group',
  plan_tier: 'free',
  plan_status: 'trialing',
};

describe('TenantManagementComponent', () => {
  let originalConfirm: typeof window.confirm;
  let component: TenantManagementComponent;
  let loading$: BehaviorSubject<boolean>;
  let activeTenant$: BehaviorSubject<Tenant | null>;
  let isSuperAdmin$: BehaviorSubject<boolean>;
  let availableTenants$: BehaviorSubject<Tenant[]>;
  let getAvailableTenants: ReturnType<typeof vi.fn>;
  let getActiveTenant: ReturnType<typeof vi.fn>;
  let getIsImpersonatingTenant: ReturnType<typeof vi.fn>;
  let switchTenant: ReturnType<typeof vi.fn>;
  let createTenant: ReturnType<typeof vi.fn>;
  let getMembershipsForActiveTenant: ReturnType<typeof vi.fn>;
  let createInvite: ReturnType<typeof vi.fn>;
  let setTenantPlan: ReturnType<typeof vi.fn>;
  let listSuperAdmins: ReturnType<typeof vi.fn>;
  let getActorEmail: ReturnType<typeof vi.fn>;
  let assignSuperAdmin: ReturnType<typeof vi.fn>;
  let removeSuperAdmin: ReturnType<typeof vi.fn>;
  let canManageTenant: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalConfirm = window.confirm;
    loading$ = new BehaviorSubject(false);
    activeTenant$ = new BehaviorSubject<Tenant | null>(tenantA);
    isSuperAdmin$ = new BehaviorSubject(false);
    availableTenants$ = new BehaviorSubject<Tenant[]>([tenantA, tenantB]);
    getAvailableTenants = vi.fn(() => [tenantA, tenantB]);
    getActiveTenant = vi.fn(() => tenantA);
    getIsImpersonatingTenant = vi.fn(() => false);
    switchTenant = vi.fn().mockResolvedValue(true);
    createTenant = vi.fn().mockResolvedValue(tenantB);
    getMembershipsForActiveTenant = vi.fn().mockResolvedValue([
      { tenant_id: tenantA.id, user_email: 'admin@test.com', role: 'tenant_admin' },
    ]);
    createInvite = vi.fn().mockResolvedValue('invite-token-123');
    setTenantPlan = vi.fn().mockResolvedValue(undefined);
    listSuperAdmins = vi.fn().mockResolvedValue([{ user_email: 'super@test.com' }]);
    getActorEmail = vi.fn().mockResolvedValue('super@test.com');
    assignSuperAdmin = vi.fn().mockResolvedValue(undefined);
    removeSuperAdmin = vi.fn().mockResolvedValue(undefined);
    canManageTenant = vi.fn().mockReturnValue(true);
    toastSuccess = vi.fn();
    toastError = vi.fn();

    component = new TenantManagementComponent(
      {
        loading$,
        activeTenant$,
        isSuperAdmin$,
        availableTenants$,
        getAvailableTenants,
        getActiveTenant,
        getIsImpersonatingTenant,
        switchTenant,
      } as any,
      {
        createTenant,
        getMembershipsForActiveTenant,
        createInvite,
        setTenantPlan,
        listSuperAdmins,
        getActorEmail,
        assignSuperAdmin,
        removeSuperAdmin,
      } as any,
      { canManageTenant } as any,
      { success: toastSuccess, error: toastError } as any
    );
    component.ngOnInit();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it('hydrates tenant context on init', async () => {
    await vi.waitFor(() => {
      expect(component.activeTenantId).toBe('tenant-a');
      expect(component.activeTenantName).toBe('Alpha Church');
      expect(component.availableTenants).toHaveLength(2);
      expect(component.memberships).toHaveLength(1);
    });
  });

  it('filteredTenants filters by name or slug', () => {
    component.tenantSearch = 'beta';
    expect(component.filteredTenants).toEqual([tenantB]);
    component.tenantSearch = '';
    expect(component.filteredTenants).toHaveLength(2);
  });

  it('createNewTenant validates input and creates organization', async () => {
    component.newTenantName = '  ';
    component.newTenantSlug = 'x';
    await component.createNewTenant();
    expect(toastError).toHaveBeenCalledWith('Name and slug are required');

    component.newTenantName = 'New Org';
    component.newTenantSlug = 'New Org!!';
    switchTenant.mockResolvedValue(true);
    await component.createNewTenant();
    expect(createTenant).toHaveBeenCalledWith('New Org', 'new-org', 'groups');
    expect(toastSuccess).toHaveBeenCalledWith(
      'Organization "Beta Group" created and set as active'
    );
    expect(component.newTenantName).toBe('');
  });

  it('createNewTenant shows success when switch fails', async () => {
    component.newTenantName = 'Gamma';
    component.newTenantSlug = 'gamma';
    switchTenant.mockResolvedValue(false);
    await component.createNewTenant();
    expect(toastSuccess).toHaveBeenCalledWith('Organization created');
  });

  it('createNewTenant surfaces errors', async () => {
    component.newTenantName = 'Gamma';
    component.newTenantSlug = 'gamma';
    createTenant.mockRejectedValue(new Error('Slug taken'));
    await component.createNewTenant();
    expect(toastError).toHaveBeenCalledWith('Slug taken');
  });

  it('setActiveTenant switches tenant or reports already active', async () => {
    await component.setActiveTenant('tenant-a');
    expect(toastSuccess).toHaveBeenCalledWith('Already using Alpha Church');

    switchTenant.mockResolvedValue(false);
    await component.setActiveTenant('tenant-b');
    expect(toastError).toHaveBeenCalledWith(
      'Unable to switch organization. Try refreshing the page.'
    );

    switchTenant.mockResolvedValue(true);
    await component.setActiveTenant('tenant-b');
    expect(toastSuccess).toHaveBeenCalledWith('Active organization is now Beta Group');
  });

  it('createInvite creates invite when tenant and email are set', async () => {
    component.inviteEmail = 'member@example.com';
    await component.createInvite();
    expect(createInvite).toHaveBeenCalledWith('tenant-a', 'member@example.com');
    expect(component.lastInviteToken).toBe('invite-token-123');
    expect(toastSuccess).toHaveBeenCalledWith('Invite created');
    expect(component.inviteEmail).toBe('');
  });

  it('createInvite returns early without tenant or email', async () => {
    component.activeTenantId = null;
    component.inviteEmail = 'x@y.com';
    await component.createInvite();
    expect(createInvite).not.toHaveBeenCalled();
  });

  it('updatePlan checks permissions and updates plan', async () => {
    canManageTenant.mockReturnValue(false);
    await component.updatePlan();
    expect(toastError).toHaveBeenCalledWith(
      'You do not have permission to update plan settings'
    );

    canManageTenant.mockReturnValue(true);
    component.planTier = 'churches';
    component.planStatus = 'trialing';
    await component.updatePlan();
    expect(setTenantPlan).toHaveBeenCalledWith('tenant-a', 'churches', 'trialing');
    expect(toastSuccess).toHaveBeenCalledWith('Tenant plan updated');
  });

  it('loads super admins when user is super admin', async () => {
    isSuperAdmin$.next(true);
    await vi.waitFor(() => {
      expect(component.isSuperAdmin).toBe(true);
      expect(component.superAdmins).toHaveLength(1);
      expect(component.actorEmail).toBe('super@test.com');
    });

    isSuperAdmin$.next(false);
    await vi.waitFor(() => {
      expect(component.superAdmins).toEqual([]);
      expect(component.actorEmail).toBeNull();
    });
  });

  it('loadSuperAdmins handles errors', async () => {
    component.isSuperAdmin = true;
    listSuperAdmins.mockRejectedValue(new Error('rpc failed'));
    await component.loadSuperAdmins();
    expect(component.superAdmins).toEqual([]);
    expect(toastError).toHaveBeenCalledWith('rpc failed');
  });

  it('assignSuperAdmin grants role and refreshes list', async () => {
    component.isSuperAdmin = true;
    component.superAdminEmail = 'new-admin@test.com';
    await component.assignSuperAdmin();
    expect(assignSuperAdmin).toHaveBeenCalledWith('new-admin@test.com');
    expect(toastSuccess).toHaveBeenCalledWith('Super admin granted');
    expect(component.superAdminEmail).toBe('');
  });

  it('filteredSuperAdmins filters by email', () => {
    component.superAdmins = [
      { user_email: 'a@test.com' },
      { user_email: 'b@test.com' },
    ];
    component.superAdminSearch = 'B@';
    expect(component.filteredSuperAdmins).toEqual([{ user_email: 'b@test.com' }]);
  });

  it('revokeSuperAdminRow confirms and revokes', async () => {
    component.isSuperAdmin = true;
    component.superAdmins = [{ user_email: 'other@test.com' }];
    component.actorEmail = 'super@test.com';
    window.confirm = vi.fn().mockReturnValue(true);

    await component.revokeSuperAdminRow('other@test.com');
    expect(removeSuperAdmin).toHaveBeenCalledWith('other@test.com');
    expect(toastSuccess).toHaveBeenCalledWith('Super admin revoked');
  });

  it('blocks revoking the only super admin when revoking self', async () => {
    component.isSuperAdmin = true;
    component.superAdmins = [{ user_email: 'super@test.com' }];
    component.actorEmail = 'super@test.com';
    await component.revokeSuperAdminRow('super@test.com');
    expect(removeSuperAdmin).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('You cannot remove the only super admin.');
  });

  it('removeSuperAdminByForm clears email on success', async () => {
    component.isSuperAdmin = true;
    component.superAdmins = [
      { user_email: 'super@test.com' },
      { user_email: 'other@test.com' },
    ];
    component.actorEmail = 'super@test.com';
    component.superAdminRevokeEmail = 'other@test.com';
    window.confirm = vi.fn().mockReturnValue(true);
    await component.removeSuperAdminByForm();
    expect(component.superAdminRevokeEmail).toBe('');
  });

  it('ngOnDestroy completes destroy subject', () => {
    const nextSpy = vi.spyOn((component as any).destroy$, 'next');
    const completeSpy = vi.spyOn((component as any).destroy$, 'complete');
    component.ngOnDestroy();
    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });
});
