const MEMSCROLL_EDGE_MARGIN = 8

/**
 * Visible bottom edge for word-mode auto-scroll: keep the blank above the word-choice
 * footer (which grows with wrapped rows) plus a small gap.
 */
export function memorizeWordModeVisibleBottom(
  scrollBottom: number,
  wordChoicesTop: number | null,
  edgeMargin: number,
  extraGapPx: number
): number {
  if (wordChoicesTop == null) return scrollBottom - edgeMargin;
  return Math.min(scrollBottom, wordChoicesTop) - edgeMargin - extraGapPx;
}

/**
 * Visible top edge when a sticky practice header (e.g. first-letters cues) covers the
 * top of the scroll column — keep the blank below that header.
 */
export function memorizeStickyHeaderVisibleTop(
  scrollTop: number,
  stickyHeaderBottom: number | null,
  edgeMargin: number
): number {
  if (stickyHeaderBottom == null) return scrollTop + edgeMargin;
  return Math.max(scrollTop, stickyHeaderBottom) + edgeMargin;
}

/**
 * Scroll the practice column only as much as needed so the blank stays in view.
 * On Android (with IME) this avoids centering math clamping to `maxScroll` and jumping to the verse bottom.
 */
export function scrollMemorizeBlankNearestInPracticeColumn(scrollEl: HTMLElement, el: HTMLElement): void {
  const scrollRect = scrollEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
  let next = scrollEl.scrollTop
  if (elRect.top < scrollRect.top + MEMSCROLL_EDGE_MARGIN) {
    next += elRect.top - scrollRect.top - MEMSCROLL_EDGE_MARGIN
  }
  if (elRect.bottom > scrollRect.bottom - MEMSCROLL_EDGE_MARGIN) {
    next += elRect.bottom - scrollRect.bottom + MEMSCROLL_EDGE_MARGIN
  }
  scrollEl.scrollTop = Math.max(0, Math.min(next, maxScroll))
}

/**
 * Scroll only the practice column so the active blank is vertically centered.
 * Used for tests / tooling; practice UI uses `scrollMemorizeBlankNearestInPracticeColumn` on Android.
 */
export function scrollMemorizeBlankIntoPracticeColumn(scrollEl: HTMLElement, el: HTMLElement): void {
  const scrollRect = scrollEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const elOffsetInScrollParent = elRect.top - scrollRect.top + scrollEl.scrollTop
  const targetTop = elOffsetInScrollParent - scrollEl.clientHeight / 2 + elRect.height / 2
  const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
  scrollEl.scrollTop = Math.max(0, Math.min(targetTop, maxScroll))
}
