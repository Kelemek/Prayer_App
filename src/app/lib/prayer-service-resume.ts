import { fromEvent, Subscription } from 'rxjs';
import { APP_BECAME_VISIBLE_EVENT } from './app-foreground';
import type { PrayerRequest } from './prayer-types';

export const PRAYER_SERVICE_INACTIVITY_ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
] as const;

export const PRAYER_APP_BECAME_VISIBLE_EVENT = APP_BECAME_VISIBLE_EVENT;

export const PRAYER_SERVICE_INACTIVITY_DETECTED_LOG =
  '[PrayerService] Inactivity detected, next activity will trigger refresh';

export function shouldSchedulePrayerResumeRefresh(): boolean {
  return !document.hidden;
}

export function isPrayerAppDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

export function registerPrayerAppBecameVisibleListener(onVisible: () => void): () => void {
  const handler = () => {
    if (shouldSchedulePrayerResumeRefresh()) {
      onVisible();
    }
  };
  window.addEventListener(PRAYER_APP_BECAME_VISIBLE_EVENT, handler);
  return () => window.removeEventListener(PRAYER_APP_BECAME_VISIBLE_EVENT, handler);
}

export function scheduleDebouncedResumeRefresh(
  existingTimeoutId: ReturnType<typeof setTimeout> | null,
  debounceMs: number,
  onRun: () => void
): ReturnType<typeof setTimeout> {
  if (existingTimeoutId != null) {
    clearTimeout(existingTimeoutId);
  }
  return setTimeout(onRun, debounceMs);
}

export function clearTimeoutIdMap(timeouts: Map<string, number>): void {
  timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  timeouts.clear();
}

export function resetInactivityTimeout(
  existingTimeoutId: ReturnType<typeof setTimeout> | null | undefined,
  thresholdMs: number,
  onInactive: () => void
): ReturnType<typeof setTimeout> {
  if (existingTimeoutId != null) {
    clearTimeout(existingTimeoutId);
  }
  return setTimeout(onInactive, thresholdMs);
}

export function readNonEmptyPrayerCache(
  readCache: () => PrayerRequest[] | null | undefined
): PrayerRequest[] | null {
  try {
    const cached = readCache();
    if (cached && cached.length > 0) {
      return cached;
    }
  } catch {
    // Cache may throw (e.g. storage unavailable)
  }
  return null;
}

export type ResumeCommunityPrayerRefreshContext = {
  readCachedPrayers: () => PrayerRequest[] | null | undefined;
  onShowCachedPrayers: (prayers: PrayerRequest[]) => void;
  ensureConnected: () => Promise<void>;
  loadPrayersSilent: () => Promise<void>;
  reconnectRealtimeIfNeeded: () => void;
  isOnline?: () => boolean;
};

export async function runResumeCommunityPrayerRefresh(
  ctx: ResumeCommunityPrayerRefreshContext
): Promise<void> {
  try {
    const cached = readNonEmptyPrayerCache(ctx.readCachedPrayers);
    if (cached) {
      ctx.onShowCachedPrayers(cached);
    }
    if (ctx.isOnline && !ctx.isOnline()) {
      return;
    }
    await ctx.ensureConnected();
    await ctx.loadPrayersSilent();
  } catch (err) {
    console.debug('[PrayerService] Resume refresh failed, keeping cached data visible:', err);
    const fallback = readNonEmptyPrayerCache(ctx.readCachedPrayers);
    if (fallback) {
      ctx.onShowCachedPrayers(fallback);
    }
  } finally {
    ctx.reconnectRealtimeIfNeeded();
  }
}

export type WirePrayerResumeListenersContext = {
  onEnterBackground: () => void;
  onLeaveBackground: () => void;
  inactivityThresholdMs: number;
  getInactivityTimeout: () => ReturnType<typeof setTimeout> | null;
  setInactivityTimeout: (id: ReturnType<typeof setTimeout> | null) => void;
  clearBackgroundRecoveryTimeouts: () => void;
};

/**
 * Inactivity plus one foreground edge (`app-became-visible`).
 * Focus and a visible `visibilitychange` must not schedule a second refresh.
 */
export function wirePrayerResumeListeners(
  ctx: WirePrayerResumeListenersContext
): Subscription[] {
  const subs: Subscription[] = [];

  const resetInactivityTimer = () => {
    ctx.setInactivityTimeout(
      resetInactivityTimeout(ctx.getInactivityTimeout(), ctx.inactivityThresholdMs, () => {
        console.log(PRAYER_SERVICE_INACTIVITY_DETECTED_LOG);
      })
    );
  };

  resetInactivityTimer();

  for (const event of PRAYER_SERVICE_INACTIVITY_ACTIVITY_EVENTS) {
    subs.push(fromEvent(document, event).subscribe(() => resetInactivityTimer()));
  }

  subs.push(
    fromEvent(document, 'visibilitychange').subscribe(() => {
      if (document.hidden) {
        ctx.onEnterBackground();
      }
    })
  );

  const unsubscribeVisible = registerPrayerAppBecameVisibleListener(() => {
    ctx.onLeaveBackground();
  });
  subs.push(new Subscription(unsubscribeVisible));

  return subs;
}

export function unsubscribePrayerResumeListeners(
  subscriptions: Subscription[]
): void {
  subscriptions.forEach((sub) => sub.unsubscribe());
}

export function mergePrayerResumeListenerSubscriptions(
  existing: Subscription[],
  added: Subscription[]
): Subscription[] {
  return [...existing, ...added];
}
