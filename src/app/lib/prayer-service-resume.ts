import { fromEvent, type Subscription } from 'rxjs';
import type { PrayerRequest } from './prayer-types';

export const PRAYER_APP_BECAME_VISIBLE_EVENT = 'app-became-visible';

export function shouldSchedulePrayerResumeRefresh(): boolean {
  return !document.hidden;
}

export function isPrayerAppDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

export function registerPrayerAppBecameVisibleListener(onVisible: () => void): void {
  window.addEventListener(PRAYER_APP_BECAME_VISIBLE_EVENT, () => {
    if (shouldSchedulePrayerResumeRefresh()) {
      onVisible();
    }
  });
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
    console.error('[PrayerService] Resume refresh failed, keeping cached data visible:', err);
    const fallback = readNonEmptyPrayerCache(ctx.readCachedPrayers);
    if (fallback) {
      ctx.onShowCachedPrayers(fallback);
    }
  } finally {
    ctx.reconnectRealtimeIfNeeded();
  }
}

export type WirePrayerResumeListenersContext = {
  scheduleResumeRefresh: () => void;
  onEnterBackground?: () => void;
  onLeaveBackground: () => void;
};

/**
 * Focus, visibility, and app-became-visible resume triggers.
 * Inactivity is not wired: a timer that only logged did not refresh the catalog.
 */
export function wirePrayerResumeListeners(
  ctx: WirePrayerResumeListenersContext
): Subscription[] {
  const subs: Subscription[] = [];

  subs.push(
    fromEvent(window, 'focus').subscribe(() => {
      if (shouldSchedulePrayerResumeRefresh()) {
        ctx.scheduleResumeRefresh();
      }
    })
  );

  subs.push(
    fromEvent(document, 'visibilitychange').subscribe(() => {
      if (document.hidden) {
        ctx.onEnterBackground?.();
      } else {
        ctx.onLeaveBackground();
        if (shouldSchedulePrayerResumeRefresh()) {
          ctx.scheduleResumeRefresh();
        }
      }
    })
  );

  registerPrayerAppBecameVisibleListener(() => {
    ctx.onLeaveBackground();
  });

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
