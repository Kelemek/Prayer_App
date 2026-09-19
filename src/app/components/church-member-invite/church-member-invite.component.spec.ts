import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ChurchMemberInviteComponent } from './church-member-invite.component';
import { TenantManagementService } from '../../services/tenant-management.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { InviteEmailSendError } from '../../lib/tenant-invite';

const INVITE_URL = 'https://cross.example.app/join/tok-123';

describe('ChurchMemberInviteComponent', () => {
  let createInvite: ReturnType<typeof vi.fn>;
  let getActiveTenant: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    createInvite = vi.fn().mockResolvedValue({ token: 'tok-123', url: INVITE_URL });
    getActiveTenant = vi.fn().mockReturnValue({ id: 'tenant-a', name: 'Cross Pointe' });
    toast = { success: vi.fn(), error: vi.fn() };
  });

  async function renderExpanded() {
    const result = await render(ChurchMemberInviteComponent, {
      providers: [
        { provide: TenantManagementService, useValue: { createInvite } },
        { provide: TenantContextService, useValue: { getActiveTenant } },
        { provide: ToastService, useValue: toast },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: /Invite members/ }));
    return result;
  }

  it('shows the email field and a disabled Create invite button until an email is typed', async () => {
    await renderExpanded();

    expect(screen.getByText(/Send someone an email invite to join this church/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Create invite' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText('Email address'), 'pat@example.com');
    expect(button.disabled).toBe(false);
  });

  it('creates the invite for the active church and shows the link', async () => {
    await renderExpanded();

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    await userEvent.type(input, '  Pat@Example.com ');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(createInvite).toHaveBeenCalledWith('tenant-a', 'pat@example.com');
    expect(await screen.findByText(/Invite emailed to pat@example.com/)).toBeTruthy();
    expect(screen.getByTestId('church-member-invite-link').getAttribute('href')).toBe(INVITE_URL);
    expect(input.value).toBe('');
    expect(toast.success).toHaveBeenCalledWith('Invitation sent to pat@example.com');
  });

  it('keeps the backup link when the invite email fails to send', async () => {
    createInvite.mockRejectedValue(new InviteEmailSendError('Resend down', 'tok-123', INVITE_URL));
    await renderExpanded();

    await userEvent.type(screen.getByLabelText('Email address'), 'pat@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(await screen.findByText(/but the email could not be sent/)).toBeTruthy();
    expect(screen.getByTestId('church-member-invite-link').getAttribute('href')).toBe(INVITE_URL);
    expect(toast.error).toHaveBeenCalledWith(
      'Invite created, but the email could not be sent. Share the link below.'
    );
  });

  it('reports other failures and leaves the email in place', async () => {
    createInvite.mockRejectedValue(new Error('invite failed'));
    await renderExpanded();

    const input = screen.getByLabelText('Email address') as HTMLInputElement;
    await userEvent.type(input, 'pat@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(toast.error).toHaveBeenCalledWith('invite failed');
    expect(screen.queryByTestId('church-member-invite-link')).toBeNull();
    expect(input.value).toBe('pat@example.com');
  });

  it('does not call the RPC without an active church', async () => {
    getActiveTenant.mockReturnValue(null);
    await renderExpanded();

    await userEvent.type(screen.getByLabelText('Email address'), 'pat@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(createInvite).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Pick a church first, then invite members.');
  });
});
