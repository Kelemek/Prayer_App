/**
 * Chromium: auto-print must run inside the popup after async content load.
 * Safari: inline scripts from opener document.write are unreliable — print from opener after focus.
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
  function afterLayout() {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        setTimeout(runPrint, 300);
      });
    });
  }
  function schedulePrint() {
    if (document.fonts && document.fonts.ready) {
      var fallback = setTimeout(afterLayout, 600);
      document.fonts.ready.then(function() {
        clearTimeout(fallback);
        afterLayout();
      }).catch(afterLayout);
    } else {
      afterLayout();
    }
  }
  if (document.readyState === 'complete') {
    schedulePrint();
  } else {
    window.addEventListener('load', schedulePrint, { once: true });
  }
})();
</script>`;

export function isLikelySafariBrowser(userAgent = navigator.userAgent): boolean {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|fxios|edg/i.test(userAgent);
}

export function injectPrintDialogScript(html: string): string {
  if (html.includes('__prayerAppPrintScheduled')) {
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

/** Write HTML into a popup opened from a user gesture; open the print dialog when ready. */
export function writeHtmlToPopupAndPrint(targetWindow: Window, html: string): void {
  const useOpenerPrint = isLikelySafariBrowser();
  const htmlToWrite = useOpenerPrint ? html : injectPrintDialogScript(html);

  targetWindow.document.open();
  targetWindow.document.write(htmlToWrite);
  targetWindow.document.close();

  try {
    targetWindow.focus();
  } catch {
    // Popup may be blocked or closed.
  }

  if (useOpenerPrint) {
    schedulePrintOnWindow(targetWindow, 450);
  }
}
