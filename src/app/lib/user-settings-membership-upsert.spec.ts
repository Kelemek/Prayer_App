import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateTenantMembershipPreferencesOnly,
  upsertTenantMembershipPreferences,
} from './user-settings-membership-upsert';
import type { TenantMembershipPreferencesService } from '../services/tenant-membership-preferences.service';

describe('upsertTenantMembershipPreferences', () => {
  let membershipPrefs: TenantMembershipPreferencesService;

  beforeEach(() => {
    membershipPrefs = {
      upsert: vi.fn(),
      updateOnly: vi.fn(),
    } as unknown as TenantMembershipPreferencesService;
  });

  it('updates via TenantMembershipPreferencesService.upsert', async () => {
    vi.mocked(membershipPrefs.upsert).mockResolvedValue({ ok: true });

    await upsertTenantMembershipPreferences(
      membershipPrefs,
      'user@example.com',
      { is_active: true },
      { is_active: false, name: 'Test' }
    );

    expect(membershipPrefs.upsert).toHaveBeenCalledWith(
      'user@example.com',
      { is_active: true },
      { is_active: false, name: 'Test' }
    );
  });

  it('throws when upsert fails', async () => {
    vi.mocked(membershipPrefs.upsert).mockResolvedValue({
      ok: false,
      error: new Error('DB error'),
    });

    await expect(
      upsertTenantMembershipPreferences(
        membershipPrefs,
        'user@example.com',
        { receive_push: true }
      )
    ).rejects.toThrow('DB error');
  });
});

describe('updateTenantMembershipPreferencesOnly', () => {
  it('updates via TenantMembershipPreferencesService.updateOnly', async () => {
    const membershipPrefs = {
      upsert: vi.fn(),
      updateOnly: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as TenantMembershipPreferencesService;

    await updateTenantMembershipPreferencesOnly(
      membershipPrefs,
      'user@example.com',
      { memorization_strict_mode: true }
    );

    expect(membershipPrefs.updateOnly).toHaveBeenCalledWith(
      'user@example.com',
      { memorization_strict_mode: true }
    );
  });
});
