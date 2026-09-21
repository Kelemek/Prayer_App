/**
 * Cross Pointe–style auto-print: inline script in the preview window (works on mobile
 * WebKit after async HTML generation). Opener-only print() loses the gesture chain.
 */
export const PRINT_POPUP_AUTO_PRINT_SCRIPT = `<script>
(function() {
  if (window.__prayerAppPrintScheduled) return;
  window.__prayerAppPrintScheduled = true;
  function runPrint() {
    try {
      window.focus();
      window.print();
    } catch (e) {}
  }
  window.addEventListener('load', function() {
    setTimeout(runPrint, 150);
  });
  if (document.readyState === 'complete') {
    setTimeout(runPrint, 150);
  }
})();
</script>`;

/** @deprecated Use injectPrintDialogScript + writeHtmlToPopupAndPrint; kept for tests. */
export function isLikelySafariBrowser(userAgent = navigator.userAgent): boolean {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|fxios|edg/i.test(userAgent);
}

export function injectPrintDialogScript(html: string): string {
  if (
    html.includes('__prayerAppPrintScheduled') ||
    html.includes('window.print(')
  ) {
    return html;
  }
  const closeBody = '</body>';
  if (html.includes(closeBody)) {
    return html.replace(closeBody, `${PRINT_POPUP_AUTO_PRINT_SCRIPT}${closeBody}`);
  }
  return `${html}${PRINT_POPUP_AUTO_PRINT_SCRIPT}`;
}

export function schedulePrintOnWindow(targetWindow: Window, delayMs = 200): void {
  const runPrint = (): void => {
    try {
      targetWindow.focus();
      targetWindow.print();
    } catch {
      // Popup may be blocked or closed.
    }
  };

  const afterLayout = (): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(runPrint, delayMs);
      });
    });
  };

  try {
    if (targetWindow.document.readyState === 'complete') {
      afterLayout();
      return;
    }
    targetWindow.addEventListener('load', afterLayout, { once: true });
  } catch {
    afterLayout();
  }
}

/** Write HTML into a popup and open the system print dialog when the page loads. */
export function writeHtmlToPopupAndPrint(targetWindow: Window, html: string): void {
  const htmlToWrite = injectPrintDialogScript(html);
  targetWindow.document.open();
  targetWindow.document.write(htmlToWrite);
  targetWindow.document.close();
  try {
    targetWindow.focus();
  } catch {
    // Popup may be blocked or closed.
  }
}
