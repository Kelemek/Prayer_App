import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantClaimComponent } from './tenant-claim.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ToastService } from '../../services/toast.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import type { TenantInvitePreview } from '../../lib/tenant-invite';

const pendingPreview: TenantInvitePreview = {
  tenantName: 'Alpha Church',
  tenantSlug: 'alpha',
  inviteeEmail: 'member@example.com',
  expiresAt: '2099-01-01T00:00:00.000Z',
  status: 'pending',
};

describe('TenantClaimComponent', () => {
  let component: TenantClaimComponent;
  let claimInvite: ReturnType<typeof vi.fn>;
  let getInvitePreview: ReturnType<typeof vi.fn>;
  let getActorEmail: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  const makeComponent = (
    token: string | null = 'invite-token-123',
    userEmail: string | null = 'member@example.com'
  ) => {
    claimInvite = vi.fn(async () => undefined);
    getInvitePreview = vi.fn(async () => pendingPreview);
    getActorEmail = vi.fn(async () => userEmail);
    logout = vi.fn(async () => undefined);
    navigate = vi.fn();
    toastSuccess = vi.fn();
    toastError = vi.fn();

    return new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => token } } } as unknown as ActivatedRoute,
      { navigate } as unknown as Router,
      { claimInvite, getInvitePreview, getActorEmail } as unknown as TenantManagementService,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      {
        getUser: () => (userEmail ? { email: userEmail } : null),
        logout,
      } as unknown as AdminAuthService
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
    await component.claimInvite();
    expect(claimInvite).toHaveBeenCalledWith('invite-token-123');
    expect(toastSuccess).toHaveBeenCalledWith('Invite claimed successfully');
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading).toBe(false);
  });

  it('shows error toast when claim fails', async () => {
    await component.ngOnInit();
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

  it('disables claim when invite is expired', async () => {
    getInvitePreview = vi.fn(async () => ({
      ...pendingPreview,
      expiresAt: '2000-01-01T00:00:00.000Z',
    }));
    component = new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => 'invite-token-123' } } } as unknown as ActivatedRoute,
      { navigate: vi.fn() } as unknown as Router,
      { claimInvite, getInvitePreview, getActorEmail } as unknown as TenantManagementService,
      { success: toastSuccess, error: toastError } as unknown as ToastService,
      {
        getUser: () => ({ email: 'member@example.com' }),
        logout,
      } as unknown as AdminAuthService
    );
    await component.ngOnInit();
    expect(component.joinState).toBe('expired');
    expect(component.canClaim).toBe(false);
    await component.claimInvite();
    expect(claimInvite).not.toHaveBeenCalled();
  });
});
