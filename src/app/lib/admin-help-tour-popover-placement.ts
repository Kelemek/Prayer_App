/** Rough popover height including footer (driver.js measures after render; this is for pre-scroll). */
export const ADMIN_HELP_TOUR_POPOVER_RESERVE_PX = 260;

export type AdminHelpTourPopoverVerticalSide = 'top' | 'bottom';

/**
 * Pick top vs bottom so the popover fits beside the highlight instead of driver.js "over" fallback.
 */
export function resolveAdminHelpTourPopoverSide(
  element: HTMLElement,
  preferred: AdminHelpTourPopoverVerticalSide = 'bottom',
  reservePx = ADMIN_HELP_TOUR_POPOVER_RESERVE_PX
): AdminHelpTourPopoverVerticalSide {
  const rect = element.getBoundingClientRect();
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  const pad = 20;

  const fitsBelow = spaceBelow >= reservePx + pad;
  const fitsAbove = spaceAbove >= reservePx + pad;

  if (preferred === 'bottom' && fitsBelow) {
    return 'bottom';
  }
  if (preferred === 'top' && fitsAbove) {
    return 'top';
  }
  if (fitsBelow && !fitsAbove) {
    return 'bottom';
  }
  if (fitsAbove && !fitsBelow) {
    return 'top';
  }
  if (fitsBelow && fitsAbove) {
    return preferred;
  }
  return spaceBelow >= spaceAbove ? 'bottom' : 'top';
}

/**
 * Scroll the page so driver.js has room to place the popover above or below the highlight.
 */
export function scrollForAdminHelpTourPopover(
  element: HTMLElement,
  side: AdminHelpTourPopoverVerticalSide,
  reservePx = ADMIN_HELP_TOUR_POPOVER_RESERVE_PX
): void {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight;

  if (side === 'bottom') {
    const spaceBelow = viewport - rect.bottom;
    const need = reservePx + 24 - spaceBelow;
    if (need > 0) {
      window.scrollBy({ top: need, behavior: 'auto' });
    }
    return;
  }

  const spaceAbove = rect.top;
  const need = reservePx + 24 - spaceAbove;
  if (need > 0) {
    window.scrollBy({ top: -need, behavior: 'auto' });
  }
}
