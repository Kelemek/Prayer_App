import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantClaimComponent } from './tenant-claim.component';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ToastService } from '../../services/toast.service';

describe('TenantClaimComponent', () => {
  let component: TenantClaimComponent;
  let claimInvite: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    claimInvite = vi.fn(async () => undefined);
    navigate = vi.fn();
    toastSuccess = vi.fn();
    toastError = vi.fn();

    component = new TenantClaimComponent(
      { snapshot: { paramMap: { get: () => 'invite-token-123' } } } as unknown as ActivatedRoute,
      { navigate } as unknown as Router,
      { claimInvite } as unknown as TenantManagementService,
      { success: toastSuccess, error: toastError } as unknown as ToastService
    );
  });

  it('reads token from route snapshot', () => {
    expect(component.token).toBe('invite-token-123');
  });

  it('claims invite and navigates home on success', async () => {
    await component.claimInvite();
    expect(claimInvite).toHaveBeenCalledWith('invite-token-123');
    expect(toastSuccess).toHaveBeenCalledWith('Invite claimed successfully');
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading).toBe(false);
  });

  it('shows error toast when claim fails', async () => {
    claimInvite.mockRejectedValue(new Error('Invalid token'));
    await component.claimInvite();
    expect(toastError).toHaveBeenCalledWith('Invalid token');
    expect(navigate).not.toHaveBeenCalled();
  });
});
