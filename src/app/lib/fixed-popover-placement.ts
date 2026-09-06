/** Open a fixed popover upward when it would clip below the visible viewport. */
export const shouldOpenFixedPopoverUp = (
  triggerTop: number,
  triggerBottom: number,
  popoverHeight: number,
  viewportBottom: number,
  viewportTop = 0,
  gap = 4
): boolean => {
  const spaceBelow = viewportBottom - triggerBottom;
  const spaceAbove = triggerTop - viewportTop;
  const needed = popoverHeight + gap;
  if (spaceBelow >= needed) {
    return false;
  }
  if (spaceAbove >= needed) {
    return true;
  }
  return spaceAbove > spaceBelow;
};

export interface FixedAnchoredMenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

/**
 * Place a `position: fixed` menu against its trigger.
 * Use the CSS max-height (not the unconstrained list height) so a bottom-sheet
 * flip-up does not leave a gap when overflow clips the panel.
 */
export const computeFixedAnchoredMenuPosition = (
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>,
  unconstrainedHeight: number,
  cssMaxHeight: number,
  viewport: { top: number; bottom: number },
  gap = 4
): FixedAnchoredMenuPosition => {
  const cssCapped = Math.max(0, Math.min(unconstrainedHeight, cssMaxHeight));
  const openUp = shouldOpenFixedPopoverUp(
    triggerRect.top,
    triggerRect.bottom,
    cssCapped,
    viewport.bottom,
    viewport.top,
    gap
  );
  const available = openUp
    ? triggerRect.top - viewport.top - gap
    : viewport.bottom - triggerRect.bottom - gap;
  const maxHeight = Math.max(0, Math.min(cssCapped, available));
  const top = openUp
    ? triggerRect.top - maxHeight - gap
    : triggerRect.bottom + gap;

  return {
    left: triggerRect.left,
    top,
    width: triggerRect.width,
    maxHeight,
    openUp,
  };
};

export interface SafeAreaViewportBounds {
  top: number;
  bottom: number;
  width: number;
}

/** Visible bounds for clipping checks (scroll viewport or visual viewport). */
export const getSafeAreaViewportBounds = (
  anchor: HTMLElement | null
): SafeAreaViewportBounds => {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, width: 0 };
  }

  let top = 0;
  let bottom = window.innerHeight;
  let width = window.innerWidth;

  const scrollRoot =
    anchor?.closest('.safe-area-viewport') ??
    document.querySelector('.safe-area-viewport');

  if (scrollRoot instanceof HTMLElement) {
    const rect = scrollRoot.getBoundingClientRect();
    top = rect.top;
    bottom = rect.bottom;
    width = rect.width;
  }

  const visualViewport = window.visualViewport;
  if (visualViewport) {
    top = Math.max(top, visualViewport.offsetTop);
    bottom = Math.min(bottom, visualViewport.offsetTop + visualViewport.height);
    width = Math.min(width, visualViewport.width);
  }

  if (typeof document !== 'undefined' && document.body) {
    const bodyPaddingBottom = Number.parseFloat(
      getComputedStyle(document.body).paddingBottom
    );
    if (Number.isFinite(bodyPaddingBottom) && bodyPaddingBottom > 0) {
      bottom = Math.min(bottom, window.innerHeight - bodyPaddingBottom);
    }
  }

  return { top, bottom, width };
};

export const ANCHORED_FIXED_DROPDOWN_MAX_HEIGHT = 240;
export const ANCHORED_FIXED_DROPDOWN_GAP = 4;

/** Viewport-fixed menu aligned to a trigger; flips up when it would clip below. */
export function buildAnchoredFixedDropdownStyle(
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>,
  viewport: Pick<SafeAreaViewportBounds, 'top' | 'bottom'>,
  estimatedHeight: number,
  maxHeight = ANCHORED_FIXED_DROPDOWN_MAX_HEIGHT,
  gap = ANCHORED_FIXED_DROPDOWN_GAP
): Record<string, string> {
  const heightCap = Math.max(0, Math.min(maxHeight, estimatedHeight));
  const openUp = shouldOpenFixedPopoverUp(
    triggerRect.top,
    triggerRect.bottom,
    heightCap,
    viewport.bottom,
    viewport.top,
    gap
  );
  const available = openUp
    ? triggerRect.top - gap - viewport.top
    : viewport.bottom - triggerRect.bottom - gap;
  const height = Math.max(0, Math.min(heightCap, available));
  const top = openUp
    ? triggerRect.top - gap - height
    : triggerRect.bottom + gap;

  return {
    top: `${top}px`,
    left: `${triggerRect.left}px`,
    width: `${triggerRect.width}px`,
    maxHeight: `${height}px`,
  };
}

export function buildAnchoredFixedDropdownStyleFromTrigger(
  trigger: HTMLElement,
  estimatedHeight: number,
  maxHeight = ANCHORED_FIXED_DROPDOWN_MAX_HEIGHT,
  gap = ANCHORED_FIXED_DROPDOWN_GAP
): Record<string, string> {
  return buildAnchoredFixedDropdownStyle(
    trigger.getBoundingClientRect(),
    getSafeAreaViewportBounds(trigger),
    estimatedHeight,
    maxHeight,
    gap
  );
}
