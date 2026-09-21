/** Sticky app chrome above main content (tenant switcher bar). */
export function measureAppTopChromeInsetPx(): number {
  const bar = document.querySelector('app-tenant-switcher-bar');
  if (!(bar instanceof HTMLElement)) {
    return 0;
  }
  return Math.ceil(bar.getBoundingClientRect().height);
}

/** Shared modal-shell inputs for Settings → Print (Prayers, Prompts, Personal, Verses). */
export const SETTINGS_PRINT_MODAL_SHELL = {
  appendToBody: true,
  reserveAppTopChrome: true,
} as const;
