/** Home page scroll container (header sticky inside). */
export const HOME_SCROLL_VIEWPORT_SELECTOR =
  ".main-page-shell .safe-area-viewport";

export function resetHomeScrollViewport(): void {
  const viewport = document.querySelector(HOME_SCROLL_VIEWPORT_SELECTOR);
  if (viewport instanceof HTMLElement) {
    viewport.scrollTop = 0;
  }
}
