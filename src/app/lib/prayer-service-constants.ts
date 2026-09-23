export const PRAYER_SERVICE_RESUME_REFRESH_DEBOUNCE_MS = 400;
export const PRAYER_SERVICE_LOAD_ERROR_TOAST_COOLDOWN_MS = 10_000;
/** Delay before opening a new prayers channel after CLOSED / CHANNEL_ERROR or client replace. */
export const PRAYER_REALTIME_RESUBSCRIBE_DELAY_MS = 250;
/** Stop automatic resubscribe after repeated immediate disconnects; resume still retries. */
export const PRAYER_REALTIME_MAX_RESUBSCRIBE_ATTEMPTS = 3;

export function shouldEmitPrayerLoadErrorToast(
  lastToastTime: number,
  cooldownMs: number
): boolean {
  return Date.now() - lastToastTime > cooldownMs;
}
