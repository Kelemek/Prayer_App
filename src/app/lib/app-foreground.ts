/**
 * One app-visible signal.
 *
 * `visibilitychange` → visible is the only dispatcher. Window focus must not
 * emit this event; listeners should not also do the same work on raw
 * visibility. Prayer and group resume share this edge.
 */
export const APP_BECAME_VISIBLE_EVENT = 'app-became-visible';

/** Collapse a second visible transition that arrives in the same beat. */
export const APP_FOREGROUND_COALESCE_MS = 750;

/**
 * After a healthy session check, skip another getSession for this long so
 * stacked foreground callers share one health check.
 */
export const FOREGROUND_CONNECTION_CHECK_WINDOW_MS = 2000;

export type InstallAppForegroundSignalOptions = {
  /** Return false to skip this visible edge (for example, missing app shell). */
  shouldDispatch?: () => boolean;
  now?: () => number;
  coalesceMs?: number;
};

let installed = false;
let lastDispatchedAt = Number.NEGATIVE_INFINITY;
let visibilityHandler: (() => void) | null = null;

export function installAppForegroundSignal(
  options: InstallAppForegroundSignalOptions = {}
): void {
  if (installed || typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  installed = true;
  const now = options.now ?? Date.now;
  const coalesceMs = options.coalesceMs ?? APP_FOREGROUND_COALESCE_MS;
  const shouldDispatch = options.shouldDispatch ?? (() => true);

  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const timestamp = now();
    if (timestamp - lastDispatchedAt < coalesceMs) {
      return;
    }
    if (!shouldDispatch()) {
      return;
    }
    lastDispatchedAt = timestamp;
    window.dispatchEvent(new CustomEvent(APP_BECAME_VISIBLE_EVENT));
  };

  document.addEventListener('visibilitychange', visibilityHandler);
}

export function resetAppForegroundSignalForTests(): void {
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = null;
  installed = false;
  lastDispatchedAt = Number.NEGATIVE_INFINITY;
}
