import { clampPrayerCooldownHours } from '../services/user-session.service';
import {
  homeDefaultPrayerViewLabel,
  type HomeDefaultPrayerView,
} from './home-default-view-preference';
import type { UserSettingsFacade } from './user-settings-facade';
import { syncMemorizationStrictModeToUserSession } from './user-settings-preferences-load';
import {
  updateTenantMembershipPreferencesOnly,
  upsertTenantMembershipPreferences,
} from './user-settings-membership-upsert';

function requireUserSettingsEmail(host: UserSettingsFacade): string | null {
  const email = host.email.toLowerCase().trim();
  if (!email) {
    host.error = 'Email not found. Please log in again.';
    return null;
  }
  return email;
}

function requireUserSettingsOnline(
  host: UserSettingsFacade,
  actionPhrase: string
): boolean {
  return host.deps.connectivity.requireOnline(actionPhrase);
}

export async function runUserSettingsNotificationToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update notification preferences')) {
    return;
  }

  host.savingNotification = true;
  host.saving = true;
  host.error = null;
  host.success = null;

  try {
    console.log(
      'Toggling notification for email:',
      email,
      'to:',
      host.receiveNotifications
    );

    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { is_active: host.receiveNotifications },
      {
        is_active: host.receiveNotifications ?? true,
        name: host.name || '',
      }
    );

    host.success = `✅ Notifications ${
      host.receiveNotifications ? 'enabled' : 'disabled'
    } successfully!`;

    await host.deps.userSessionService.updateUserSession({
      isActive: host.receiveNotifications ?? true,
    });

    host.savingNotification = false;
    host.saving = false;
    host.markForCheck();
    host.successNotification = host.receiveNotifications
      ? '✅ Prayer notifications enabled'
      : '✅ Prayer notifications disabled';
    setTimeout(() => {
      host.successNotification = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating notification preference:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update preference';
    host.receiveNotifications = !host.receiveNotifications;
    host.savingNotification = false;
    host.saving = false;
    host.markForCheck();
  } finally {
    console.log('Setting saving to false');
  }
}

export async function runUserSettingsPushNotificationToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update push notification preferences')) {
    return;
  }

  host.savingPushNotification = true;
  host.error = null;
  host.successPushNotification = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { receive_push: host.receivePushNotifications },
      {
        is_active: host.receiveNotifications ?? true,
        receive_push: host.receivePushNotifications ?? false,
        name: host.name || '',
      }
    );

    await host.deps.userSessionService.updateUserSession({
      receivePush: host.receivePushNotifications ?? false,
    });

    host.successPushNotification = host.receivePushNotifications
      ? '✅ Push notifications enabled'
      : '✅ Push notifications disabled';
    setTimeout(() => {
      host.successPushNotification = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating push notification preference:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update preference';
    host.receivePushNotifications = !host.receivePushNotifications;
    host.markForCheck();
  } finally {
    host.savingPushNotification = false;
    host.markForCheck();
  }
}

export async function runUserSettingsBadgeFunctionalityToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update badge preferences')) {
    return;
  }

  host.savingBadge = true;
  host.error = null;
  host.success = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { badge_functionality_enabled: host.badgeFunctionalityEnabled },
      { badge_functionality_enabled: host.badgeFunctionalityEnabled }
    );

    if (host.badgeFunctionalityEnabled) {
      host.markAllItemsAsRead();
      host.successBadge = '✅ Notification badges enabled';
    } else {
      host.successBadge = '✅ Notification badges disabled';
    }

    await host.deps.userSessionService.updateUserSession({
      badgeFunctionalityEnabled: host.badgeFunctionalityEnabled ?? false,
    });

    host.savingBadge = false;
    host.markForCheck();

    setTimeout(() => {
      host.successBadge = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating badge preference:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update badge preference';
    host.badgeFunctionalityEnabled = !host.badgeFunctionalityEnabled;
    host.savingBadge = false;
    host.markForCheck();
  } finally {
    host.savingBadge = false;
    host.markForCheck();
  }
}

export async function runUserSettingsMemorizationStrictModeToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update memorization practice')) {
    return;
  }

  if (!host.tenantContext.getActiveTenant()?.id) {
    host.error =
      'Join or select an organization before changing memorization practice.';
    host.memorizationStrictMode = !host.memorizationStrictMode;
    host.savingMemorizationStrictMode = false;
    host.markForCheck();
    return;
  }

  host.savingMemorizationStrictMode = true;
  host.error = null;
  host.successMemorizationStrictMode = null;

  try {
    await updateTenantMembershipPreferencesOnly(
      host.deps.membershipPrefs,
      email,
      { memorization_strict_mode: host.memorizationStrictMode }
    );

    await syncMemorizationStrictModeToUserSession(host, email);

    host.successMemorizationStrictMode = host.memorizationStrictMode
      ? '✅ Strict memorization practice enabled'
      : '✅ Standard memorization practice enabled';

    host.savingMemorizationStrictMode = false;
    host.markForCheck();

    setTimeout(() => {
      host.successMemorizationStrictMode = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating memorization strict mode:', err);
    host.error =
      err instanceof Error
        ? err.message
        : 'Failed to update memorization practice preference';
    host.memorizationStrictMode = !host.memorizationStrictMode;
    host.savingMemorizationStrictMode = false;
    host.markForCheck();
  }
}

export async function runUserSettingsShowPrayForButtonToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update prayer encouragement settings')) {
    return;
  }
  const next = host.showPrayForButton ?? true;
  host.savingShowPrayForButton = true;
  host.error = null;
  host.successPrayerEncouragementUi = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { show_pray_for_button: next },
      { name: host.name || '', show_pray_for_button: next }
    );

    await host.deps.userSessionService.updateUserSession({
      showPrayForButton: next,
    });
    host.successPrayerEncouragementUi = next
      ? 'Pray For button shown on cards'
      : 'Pray For button hidden on cards';
    setTimeout(() => {
      host.successPrayerEncouragementUi = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating show Pray For preference:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update preference';
    host.showPrayForButton = !next;
  } finally {
    host.savingShowPrayForButton = false;
    host.markForCheck();
  }
}

export async function runUserSettingsShowPrayingCountToggle(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update prayer encouragement settings')) {
    return;
  }
  const next = host.showPrayingCount ?? true;
  host.savingShowPrayingCount = true;
  host.error = null;
  host.successPrayerEncouragementUi = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { show_praying_count: next },
      { name: host.name || '', show_praying_count: next }
    );

    await host.deps.userSessionService.updateUserSession({
      showPrayingCount: next,
    });
    host.successPrayerEncouragementUi = next
      ? 'Praying count shown when available'
      : 'Praying count hidden on cards';
    setTimeout(() => {
      host.successPrayerEncouragementUi = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating show praying count preference:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update preference';
    host.showPrayingCount = !next;
  } finally {
    host.savingShowPrayingCount = false;
    host.markForCheck();
  }
}

export async function runUserSettingsPersonalPrayerCooldownSave(
  host: UserSettingsFacade
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update prayer encouragement settings')) {
    return;
  }

  if (!host.personalPrayerCooldownEdited) {
    host.personalPrayerCooldownHours =
      host.deps.userSessionService.getPersonalPrayerCooldownHours();
    return;
  }

  const next = clampPrayerCooldownHours(host.personalPrayerCooldownHours);
  const current = host.deps.userSessionService.getPersonalPrayerCooldownHours();
  if (next === current) {
    host.personalPrayerCooldownHours = next;
    host.personalPrayerCooldownEdited = false;
    return;
  }

  host.personalPrayerCooldownHours = next;
  host.savingPersonalPrayerCooldown = true;
  host.error = null;
  host.successPrayerEncouragementUi = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { personal_prayer_cooldown_hours: next },
      { name: host.name || '', personal_prayer_cooldown_hours: next }
    );

    await host.deps.userSessionService.updateUserSession({
      personalPrayerCooldownHours: next,
    });
    host.personalPrayerCooldownEdited = false;
    host.successPrayerEncouragementUi = `Personal / member / prompt cooldown set to ${next} ${
      next === 1 ? 'hour' : 'hours'
    }`;
    setTimeout(() => {
      host.successPrayerEncouragementUi = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating personal prayer cooldown:', err);
    host.error =
      err instanceof Error ? err.message : 'Failed to update preference';
    host.personalPrayerCooldownHours = current;
  } finally {
    host.savingPersonalPrayerCooldown = false;
    host.markForCheck();
  }
}

export async function runUserSettingsDefaultViewChange(
  host: UserSettingsFacade,
  newView: HomeDefaultPrayerView,
  previousView: HomeDefaultPrayerView | null = host.defaultPrayerView
): Promise<void> {
  const email = requireUserSettingsEmail(host);
  if (!email) {
    return;
  }
  if (!requireUserSettingsOnline(host, 'update default view')) {
    return;
  }

  host.defaultPrayerView = newView;
  host.savingDefaultView = true;
  host.error = null;
  host.success = null;

  try {
    await upsertTenantMembershipPreferences(
      host.deps.membershipPrefs,
      email,
      { default_prayer_view: newView }
    );

    host.successDefaultView = `✅ Default view set to ${homeDefaultPrayerViewLabel(newView)}`;

    await host.deps.userSessionService.updateUserSession({
      defaultPrayerView: newView,
    });

    host.savingDefaultView = false;
    host.markForCheck();

    setTimeout(() => {
      host.successDefaultView = null;
      host.markForCheck();
    }, 3000);
  } catch (err) {
    console.error('Error updating default view preference:', err);
    host.error =
      err instanceof Error
        ? err.message
        : 'Failed to update default view preference';
    host.defaultPrayerView = previousView ?? 'current';
    host.savingDefaultView = false;
    host.markForCheck();
  }
}
