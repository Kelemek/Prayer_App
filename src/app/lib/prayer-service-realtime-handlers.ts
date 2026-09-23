import {
  communityPrayerReminderDropFromPayload,
  handlePrayerRealtimeSubscribeStatus,
  personalPrayerReminderDropFromPayload,
  shouldReloadPersonalPrayersAfterRealtimePayload,
  type PostgresChangePayload,
  type PrayerCatalogRealtimeHandlers,
  type PrayerRealtimeReminderKind,
} from './prayer-service-realtime';

export type PrayerCatalogRealtimeHandlerDeps = {
  dropRemindersForPrayer?: (
    prayerId: string,
    kind: PrayerRealtimeReminderKind
  ) => void;
  /** Must bypass the warm catalog cache. A silent skip leaves the list stale. */
  reloadCommunityPrayers: () => Promise<void>;
  /** Must bypass the warm catalog cache. Not subscribed unless the caller opts in. */
  reloadPersonalPrayers: () => Promise<void>;
  onDisconnected?: () => void;
};

export function buildPrayerCatalogRealtimeHandlers(
  deps: PrayerCatalogRealtimeHandlerDeps
): PrayerCatalogRealtimeHandlers {
  return {
    onPrayersChange: (payload: PostgresChangePayload) => {
      const reminderDrop = communityPrayerReminderDropFromPayload(payload);
      if (reminderDrop) {
        deps.dropRemindersForPrayer?.(reminderDrop.prayerId, reminderDrop.kind);
      }
      deps.reloadCommunityPrayers().catch((err) => {
        console.error('[PrayerService] Error reloading after prayer change:', err);
      });
    },
    onPrayerUpdatesChange: (_payload: PostgresChangePayload) => {
      deps.reloadCommunityPrayers().catch((err) => {
        console.error('[PrayerService] Error reloading after update change:', err);
      });
    },
    onPersonalPrayersChange: (payload: PostgresChangePayload) => {
      const reminderDrop = personalPrayerReminderDropFromPayload(payload);
      if (reminderDrop) {
        deps.dropRemindersForPrayer?.(reminderDrop.prayerId, reminderDrop.kind);
      }
      if (!shouldReloadPersonalPrayersAfterRealtimePayload(payload)) {
        return;
      }
      deps.reloadPersonalPrayers().catch((err) => {
        console.error('[PrayerService] Error reloading after personal prayer change:', err);
      });
    },
    onSubscribeStatus: (status: string) => {
      handlePrayerRealtimeSubscribeStatus(status, () => {
        deps.onDisconnected?.();
      });
    },
  };
}
