import { Printer } from '@capgo/capacitor-printer';

/** Hidden iframe used for iOS printing (WKWebView print respects @page / page breaks). */
export const NATIVE_PRINT_IFRAME_ID = 'prayer-app-native-print-frame';

/** Detect if running in native Capacitor app (iOS or Android). */
export function isPrintNativeApp(): boolean {
  try {
    const hasCapacitor =
      typeof (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor !==
      'undefined';
    let platform: string | null = null;

    if (hasCapacitor) {
      try {
        platform = (
          window as unknown as { Capacitor: { getPlatform: () => string } }
        ).Capacitor.getPlatform();
      } catch (e) {
        console.debug('[Print] Error getting platform:', e);
      }
    }

    const isNative = hasCapacitor && (platform === 'ios' || platform === 'android');
    console.log('[Print] Native app check:', isNative, {
      hasCapacitor,
      platform,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
    return isNative;
  } catch (e) {
    console.error('[Print] Error checking native app:', e);
    return false;
  }
}

function getCapacitorPlatform(): string | null {
  try {
    return (
      window as { Capacitor?: { getPlatform?: () => string } }
    ).Capacitor?.getPlatform?.() ?? null;
  } catch {
    return null;
  }
}

function isUserCancelledPrintError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('cancelled') || lower.includes('user');
}

async function waitForPrintIframeReady(iframe: HTMLIFrameElement): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Print preview timed out'));
    }, 15_000);

    const finish = (): void => {
      window.clearTimeout(timeout);
      resolve();
    };

    iframe.addEventListener('load', finish, { once: true });
    const doc = iframe.contentDocument;
    if (doc?.readyState === 'complete') {
      finish();
    }
  });

  // Let WebKit apply print layout after the document is parsed.
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 150);
  });
}

/**
 * iOS `printHtml` uses UIMarkupTextPrintFormatter, which ignores CSS page breaks.
 * Load HTML in a hidden iframe and call `printIframe` so WKWebView's print() runs.
 */
export async function mountNativePrintHtmlIframe(html: string): Promise<HTMLIFrameElement> {
  document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = NATIVE_PRINT_IFRAME_ID;
  iframe.setAttribute(
    'style',
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden'
  );
  iframe.setAttribute('title', 'Print preview');
  document.body.appendChild(iframe);

  iframe.srcdoc = html;
  await waitForPrintIframeReady(iframe);
  return iframe;
}

export function removeNativePrintHtmlIframe(): void {
  document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();
}

async function printHtmlOnIosViaIframe(html: string, title: string): Promise<void> {
  try {
    await mountNativePrintHtmlIframe(html);
    await Printer.printIframe({
      selector: `#${NATIVE_PRINT_IFRAME_ID}`,
      name: title,
    });
  } finally {
    removeNativePrintHtmlIframe();
  }
}

/** Share or save print HTML on native app via @capgo/capacitor-printer. */
export async function sharePrintHtmlOnNativeApp(
  html: string,
  _filename: string,
  title: string
): Promise<void> {
  try {
    const platform = getCapacitorPlatform();
    if (platform !== 'ios' && platform !== 'android') {
      return;
    }

    try {
      if (platform === 'ios') {
        await printHtmlOnIosViaIframe(html, title);
      } else {
        await Printer.printHtml({
          name: title,
          html,
        });
      }
    } catch (error) {
      console.error('[Print] Printer plugin error:', error);
      const message = (error as { message?: string })?.message || 'Unknown error';
      if (!isUserCancelledPrintError(message)) {
        alert(`Failed to open print dialog: ${message}`);
      }
    }
  } catch (error) {
    console.error('[Print] Error in sharePrintHtmlOnNativeApp:', error);
    const message = (error as { message?: string })?.message || 'Unknown error';
    if (!isUserCancelledPrintError(message)) {
      alert(`Error: ${message}`);
    }
  }
}
