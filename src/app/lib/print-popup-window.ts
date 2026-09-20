/**
 * Auto-print runs inside the popup (required for Chrome/Edge after async content load).
 * Opener-only print() loses the user-gesture chain and is ignored.
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
      document.fonts.ready.then(afterLayout).catch(afterLayout);
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

/** Write HTML into a popup opened from a user gesture; print dialog runs in the popup. */
export function writeHtmlToPopupAndPrint(targetWindow: Window, html: string): void {
  const htmlWithPrint = injectPrintDialogScript(html);
  targetWindow.document.open();
  targetWindow.document.write(htmlWithPrint);
  targetWindow.document.close();
  try {
    targetWindow.focus();
  } catch {
    // Popup may be blocked or closed.
  }
}

/** @deprecated Prefer writeHtmlToPopupAndPrint — opener print() fails in Chromium after async. */
export function schedulePrintOnWindow(targetWindow: Window): void {
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
        setTimeout(runPrint, 200);
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
