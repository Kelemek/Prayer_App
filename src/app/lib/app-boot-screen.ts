import {
  Event as RouterEvent,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { filter, take } from 'rxjs/operators';

/** Static overlay in `src/index.html` shown until the first paintable root. */
export const APP_BOOT_SCREEN_ID = 'app-boot-screen';

const APP_BOOT_SCREEN_FAILSAFE_MS = 15_000;

let failsafeTimer: ReturnType<typeof setTimeout> | undefined;

export function armAppBootScreenFailsafe(
  ms = APP_BOOT_SCREEN_FAILSAFE_MS
): void {
  if (failsafeTimer !== undefined) {
    clearTimeout(failsafeTimer);
  }
  failsafeTimer = setTimeout(() => dismissAppBootScreen(), ms);
}

export function dismissAppBootScreen(): void {
  if (failsafeTimer !== undefined) {
    clearTimeout(failsafeTimer);
    failsafeTimer = undefined;
  }
  document.getElementById(APP_BOOT_SCREEN_ID)?.remove();
}

function isAppBootScreenTerminalNavigation(
  event: RouterEvent
): event is NavigationEnd | NavigationError {
  return event instanceof NavigationEnd || event instanceof NavigationError;
}

/**
 * Drop the HTML boot spinner once the first paintable root is ready:
 * a non-routed root (no router-outlet) or the first settled route.
 * Subscribe before reading lastSuccessfulNavigation so a NavigationEnd in
 * that gap is not missed.
 */
export function bindAppBootScreenDismissal(
  router: Pick<Router, 'events' | 'lastSuccessfulNavigation'>
): void {
  if (!document.querySelector('router-outlet')) {
    dismissAppBootScreen();
    return;
  }

  const sub = router.events
    .pipe(filter(isAppBootScreenTerminalNavigation), take(1))
    .subscribe(() => dismissAppBootScreen());

  if (router.lastSuccessfulNavigation() != null) {
    sub.unsubscribe();
    dismissAppBootScreen();
  }
}
