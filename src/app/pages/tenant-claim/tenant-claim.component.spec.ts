import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { TenantClaimComponent } from './tenant-claim.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantManagementService } from '../../services/tenant-management.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { UserSessionService } from '../../services/user-session.service';
import type { TenantInvitePreview } from '../../lib/tenant-invite';

const pendingPreview: TenantInvitePreview = {
  tenantName: 'Alpha Church',
  tenantSlug: 'alpha',
  inviteeEmail: 'member@example.com',
  expiresAt: '2099-01-01T00:00:00.000Z',
  status: 'pending',
};

const stubCdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
const stubUserSession = {
  loadUserSession: vi.fn(async () => undefined),
} as unknown as UserSessionService;
const stubTenantContext = {
  switchTenant: vi.fn(async () => undefined),
} as unknown as TenantContextService;
const stubTenantManagementExtras = {
  getActorDisplayName: vi.fn(async () => ''),
};

describe('TenantClaimComponent', () => {
  let component: TenantClaimComponent;
  let claimInvite: ReturnType<typeof vi.fn>;
  let getInvitePreview: ReturnType<typeof vi.fn>;
  let getActorEmail: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let getActorDisplayName: ReturnType<typeof vi.fn>;
  let loadUserSession: ReturnType<typeof vi.fn>;
  let switchTenant: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  const makeComponent = (
    token: string | null = 'invite-token-123',
    userEmail: string | null = 'member@example.com'
  ) => {
    claimInvite = vi.fn(async () => 'tenant-joined');
    getInvitePreview = vi.fn(async () => pendingPreview);
    getActorEmail = vi.fn(async () => userEmail);
    logout = vi.fn(async () => undefined);
    navigate = vi.fn();
    navigateByUrl = vi.fn(async () => true);
    getActorDisplayName = vi.fn(async () => '');
    loadUserSession = vi.fn(async () => undefined);
    switchTenant = vi.fn(async () => undefined);
    toastSuccess = vi.fn();
    toastError = vi.fn();

    return new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => token } } } as unknown as ActivatedRoute,
      { navigate, navigateByUrl } as unknown as Router,
      {
        claimInvite,
        getInvitePreview,
        getActorEmail,
        getActorDisplayName,
      } as unknown as TenantManagementService,
      { switchTenant } as unknown as TenantContextService,
      { loadUserSession } as unknown as UserSessionService,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      {
        getUser: () => (userEmail ? { email: userEmail } : null),
        logout,
      } as unknown as AdminAuthService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef
    );
  };

  beforeEach(() => {
    component = makeComponent();
  });

  it('reads token from route snapshot', () => {
    expect(component.token).toBe('invite-token-123');
  });

  it('claims invite and navigates home on success', async () => {
    await component.ngOnInit();
    component.firstName = 'Pat';
    component.lastName = 'Lee';
    await component.claimInvite();
    expect(claimInvite).toHaveBeenCalledWith('invite-token-123', 'Pat Lee');
    expect(switchTenant).toHaveBeenCalledWith('tenant-joined');
    expect(loadUserSession).toHaveBeenCalledWith('member@example.com');
    expect(toastSuccess).toHaveBeenCalledWith('Invite claimed successfully');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(component.loading).toBe(false);
  });

  it('does not claim without first and last name', async () => {
    await component.ngOnInit();
    component.firstName = 'Pat';
    component.lastName = '';
    await component.claimInvite();
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('shows error toast when claim fails', async () => {
    await component.ngOnInit();
    component.firstName = 'Pat';
    component.lastName = 'Lee';
    claimInvite.mockRejectedValue(new Error('Invalid token'));
    await component.claimInvite();
    expect(toastError).toHaveBeenCalledWith('Invalid token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows mismatch copy and signs out to the invited email', async () => {
    component = makeComponent('invite-token-123', 'other@example.com');
    await component.ngOnInit();
    expect(component.joinState).toBe('mismatch');
    expect(component.statusCopy).toContain('member@example.com');
    expect(component.canClaim).toBe(false);
    await component.signInAsInvitee();
    expect(logout).toHaveBeenCalledWith({
      returnUrl: '/join/invite-token-123',
      email: 'member@example.com',
    });
  });

  it('handles missing token on init', async () => {
    component = makeComponent(null);
    await component.ngOnInit();
    expect(component.joinState).toBe('missing-token');
    expect(component.statusCopy).toContain('missing a token');
    expect(component.heading).toBe('Join church');
  });

  it('surfaces not-found when preview is null', async () => {
    getInvitePreview = vi.fn(async () => null);
    component = new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => 'invite-token-123' } } } as unknown as ActivatedRoute,
      { navigate: vi.fn() } as unknown as Router,
      { claimInvite, getInvitePreview, getActorEmail, ...stubTenantManagementExtras } as unknown as TenantManagementService,
      stubTenantContext,
      stubUserSession,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      {
        getUser: () => ({ email: 'member@example.com' }),
        logout,
      } as unknown as AdminAuthService,
      stubCdr
    );
    await component.ngOnInit();
    expect(component.joinState).toBe('not-found');
  });

  it('uses actor email when admin user is absent', async () => {
    component = new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => 'invite-token-123' } } } as unknown as ActivatedRoute,
      { navigate: vi.fn() } as unknown as Router,
      {
        claimInvite,
        getInvitePreview,
        getActorEmail: vi.fn(async () => 'actor@example.com'),
        ...stubTenantManagementExtras,
      } as unknown as TenantManagementService,
      stubTenantContext,
      stubUserSession,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      { getUser: () => null, logout } as unknown as AdminAuthService,
      stubCdr
    );
    await component.ngOnInit();
    expect(component.currentEmail).toBe('actor@example.com');
  });

  it('shows revoked and accepted copy', async () => {
    for (const status of ['revoked', 'accepted'] as const) {
      getInvitePreview = vi.fn(async () => ({ ...pendingPreview, status }));
      component = new TenantClaimComponent(
        { snapshot: { paramMap: { get: () => 't' } } } as unknown as ActivatedRoute,
        { navigate: vi.fn() } as unknown as Router,
        { claimInvite, getInvitePreview, getActorEmail, ...stubTenantManagementExtras } as unknown as TenantManagementService,
        stubTenantContext,
        stubUserSession,
        { success: toastSuccess, error: toastError } as unknown as ToastService,
        {
          getUser: () => ({ email: 'member@example.com' }),
          logout,
        } as unknown as AdminAuthService,
        stubCdr
      );
      await component.ngOnInit();
      expect(component.joinState).toBe(status);
      expect(component.statusCopy.length).toBeGreaterThan(10);
    }
  });

  it('shows ready heading and claim label', async () => {
    await component.ngOnInit();
    expect(component.heading).toBe('Join Alpha Church');
    expect(component.claimButtonLabel).toBe('Join Alpha Church');
    expect(component.statusCopy).toContain('Enter your name');
  });

  it('prompts sign-in when invite is valid but user is anonymous', async () => {
    component = makeComponent('invite-token-123', null);
    await component.ngOnInit();
    expect(component.needsSignIn).toBe(true);
    expect(component.canClaim).toBe(false);
    expect(component.statusCopy).toContain('Sign in as member@example.com');
    component.goToSignIn();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/join/invite-token-123' },
    });
  });

  it('does not claim when already loading', async () => {
    await component.ngOnInit();
    component.loading = true;
    await component.claimInvite();
    expect(claimInvite).not.toHaveBeenCalled();
  });

  it('toasts when sign-out fails', async () => {
    component = makeComponent('invite-token-123', 'other@example.com');
    logout.mockRejectedValue(new Error('logout failed'));
    await component.ngOnInit();
    await component.signInAsInvitee();
    expect(toastError).toHaveBeenCalledWith('logout failed');
    expect(component.signingOut).toBe(false);
  });

  it('disables claim when invite is expired', async () => {
    getInvitePreview = vi.fn(async () => ({
      ...pendingPreview,
      expiresAt: '2000-01-01T00:00:00.000Z',
    }));
    component = new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => 'invite-token-123' } } } as unknown as ActivatedRoute,
      { navigate: vi.fn() } as unknown as Router,
      { claimInvite, getInvitePreview, getActorEmail, ...stubTenantManagementExtras } as unknown as TenantManagementService,
      stubTenantContext,
      stubUserSession,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      {
        getUser: () => ({ email: 'member@example.com' }),
        logout,
      } as unknown as AdminAuthService,
      stubCdr
    );
    await component.ngOnInit();
    expect(component.joinState).toBe('expired');
    expect(component.canClaim).toBe(false);
    await component.claimInvite();
    expect(claimInvite).not.toHaveBeenCalled();
  });
});
