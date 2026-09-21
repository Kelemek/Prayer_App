/** Breathing room between the tenant switcher and the modal card. */
export const APP_TOP_CHROME_OVERLAY_GAP = '0.75rem';

/** Sticky app chrome above main content (tenant switcher bar). */
export function measureAppTopChromeInsetPx(): number {
  const bar = document.querySelector('app-tenant-switcher-bar');
  if (!(bar instanceof HTMLElement)) {
    return 0;
  }
  return Math.ceil(bar.getBoundingClientRect().height);
}

/** Overlay `padding-top` so a full-screen modal sits below the tenant switcher bar. */
export function appTopChromeOverlayPaddingTop(): string | null {
  const chromePx = measureAppTopChromeInsetPx();
  if (chromePx <= 0) {
    return null;
  }
  return appTopChromeOverlayPaddingTopFromPx(chromePx);
}

export function appTopChromeOverlayPaddingTopFromPx(chromePx: number): string {
  return `calc(env(safe-area-inset-top, 0px) + ${chromePx}px + ${APP_TOP_CHROME_OVERLAY_GAP})`;
}

/** Shared modal-shell inputs for Settings → Print (Prayers, Prompts, Personal, Verses). */
export const SETTINGS_PRINT_MODAL_SHELL = {
  appendToBody: true,
  reserveAppTopChrome: true,
} as const;
