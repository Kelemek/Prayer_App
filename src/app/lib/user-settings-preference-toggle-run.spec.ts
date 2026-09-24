import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { UserSettingsFacade } from './user-settings-facade';
import {
  runUserSettingsBadgeFunctionalityToggle,
  runUserSettingsDefaultViewChange,
  runUserSettingsMemorizationStrictModeToggle,
  runUserSettingsNotificationToggle,
  runUserSettingsPersonalPrayerCooldownSave,
  runUserSettingsPushNotificationToggle,
  runUserSettingsShowPrayForButtonToggle,
  runUserSettingsShowPrayingCountToggle,
} from './user-settings-preference-toggle-run';

vi.mock('./user-settings-membership-upsert', () => ({
  upsertTenantMembershipPreferences: vi.fn().mockResolvedValue(undefined),
  updateTenantMembershipPreferencesOnly: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./user-settings-preferences-load', () => ({
  syncMemorizationStrictModeToUserSession: vi.fn().mockResolvedValue(undefined),
}));

import {
  upsertTenantMembershipPreferences,
  updateTenantMembershipPreferencesOnly,
} from './user-settings-membership-upsert';

function createHost(overrides: Partial<UserSettingsFacade> = {}): UserSettingsFacade {
  const deps = {
    connectivity: { requireOnline: vi.fn(() => true) },
    membershipPrefs: {},
    userSessionService: {
      updateUserSession: vi.fn().mockResolvedValue(undefined),
      getPersonalPrayerCooldownHours: vi.fn(() => 4),
    },
    tenantContext: { getActiveTenant: () => ({ id: 'tenant-1' }) },
  };
  return {
    email: 'User@Example.com',
    name: 'User',
    receiveNotifications: true,
    receivePushNotifications: false,
    badgeFunctionalityEnabled: true,
    memorizationStrictMode: false,
    showPrayForButton: true,
    showPrayingCount: true,
    personalPrayerCooldownHours: 4,
    personalPrayerCooldownEdited: false,
    defaultPrayerView: 'current',
    saving: false,
    savingNotification: false,
    savingPushNotification: false,
    savingBadge: false,
    savingMemorizationStrictMode: false,
    savingShowPrayForButton: false,
    savingShowPrayingCount: false,
    savingPersonalPrayerCooldown: false,
    savingDefaultView: false,
    error: null,
    success: null,
    successNotification: null,
    successPushNotification: null,
    successBadge: null,
    successMemorizationStrictMode: null,
    successPrayerEncouragementUi: null,
    successDefaultView: null,
    markForCheck: vi.fn(),
    markAllItemsAsRead: vi.fn(),
    deps,
    tenantContext: deps.tenantContext,
    ...overrides,
  } as unknown as UserSettingsFacade;
}

describe('user-settings-preference-toggle-run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upsertTenantMembershipPreferences).mockResolvedValue(undefined);
  });

  it('returns early without email or when offline', async () => {
    const host = createHost({ email: '  ' });
    await runUserSettingsNotificationToggle(host);
    expect(upsertTenantMembershipPreferences).not.toHaveBeenCalled();

    const offline = createHost();
    vi.mocked(offline.deps.connectivity.requireOnline).mockReturnValue(false);
    await runUserSettingsNotificationToggle(offline);
    expect(upsertTenantMembershipPreferences).not.toHaveBeenCalled();
  });

  it('runUserSettingsNotificationToggle persists preference', async () => {
    const host = createHost({ receiveNotifications: false });
    await runUserSettingsNotificationToggle(host);
    expect(upsertTenantMembershipPreferences).toHaveBeenCalled();
    expect(host.deps.userSessionService.updateUserSession).toHaveBeenCalled();
  });

  it('runUserSettingsPushNotificationToggle and badge toggle', async () => {
    const host = createHost();
    await runUserSettingsPushNotificationToggle(host);
    await runUserSettingsBadgeFunctionalityToggle(host);
    expect(host.markAllItemsAsRead).toHaveBeenCalled();
  });

  it('runUserSettingsMemorizationStrictModeToggle requires tenant', async () => {
    const host = createHost({ memorizationStrictMode: true });
    host.tenantContext = { getActiveTenant: () => null } as never;
    host.deps.tenantContext = host.tenantContext;
    await runUserSettingsMemorizationStrictModeToggle(host);
    expect(updateTenantMembershipPreferencesOnly).not.toHaveBeenCalled();
    expect(host.memorizationStrictMode).toBe(false);
  });

  it('runUserSettingsMemorizationStrictModeToggle updates when tenant present', async () => {
    const host = createHost({ memorizationStrictMode: true });
    await runUserSettingsMemorizationStrictModeToggle(host);
    expect(updateTenantMembershipPreferencesOnly).toHaveBeenCalled();
  });

  it('prayer encouragement toggles persist', async () => {
    const host = createHost({ showPrayForButton: false, showPrayingCount: false });
    await runUserSettingsShowPrayForButtonToggle(host);
    await runUserSettingsShowPrayingCountToggle(host);
    expect(upsertTenantMembershipPreferences).toHaveBeenCalledTimes(2);
  });

  it('runUserSettingsPersonalPrayerCooldownSave skips when not edited', async () => {
    const host = createHost({ personalPrayerCooldownEdited: false });
    await runUserSettingsPersonalPrayerCooldownSave(host);
    expect(upsertTenantMembershipPreferences).not.toHaveBeenCalled();
  });

  it('runUserSettingsPersonalPrayerCooldownSave persists edited value', async () => {
    const host = createHost({
      personalPrayerCooldownEdited: true,
      personalPrayerCooldownHours: 6,
    });
    host.deps.userSessionService.getPersonalPrayerCooldownHours = vi.fn(() => 4);
    await runUserSettingsPersonalPrayerCooldownSave(host);
    expect(upsertTenantMembershipPreferences).toHaveBeenCalled();
    expect(host.personalPrayerCooldownEdited).toBe(false);
  });

  it('runUserSettingsDefaultViewChange updates view', async () => {
    const host = createHost();
    await runUserSettingsDefaultViewChange(host, 'personal');
    expect(host.defaultPrayerView).toBe('personal');
    expect(upsertTenantMembershipPreferences).toHaveBeenCalled();
  });

  it('reverts notification toggle on error', async () => {
    vi.mocked(upsertTenantMembershipPreferences).mockRejectedValueOnce(new Error('fail'));
    const host = createHost({ receiveNotifications: true });
    await runUserSettingsNotificationToggle(host);
    expect(host.receiveNotifications).toBe(false);
    expect(host.error).toBe('fail');
  });
});
