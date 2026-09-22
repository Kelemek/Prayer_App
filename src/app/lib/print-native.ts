import { Printer } from '@capgo/capacitor-printer';

const NATIVE_PRINT_IFRAME_ID = 'prayer-app-native-print-frame';
const IOS_PRINT_IFRAME_CLEANUP_MS = 120_000;

export type SharePrintHtmlNativeOptions = {
  /**
   * iOS only: print via a hidden iframe + WKWebView `print()`.
   * Use for memorization duplex — `printHtml` uses UIMarkupTextPrintFormatter and can freeze
   * or show a blank preview on multi-page card layouts.
   */
  iosWebKitPrint?: boolean;
};

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
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Print preview timed out'));
      }
    }, 15_000);

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };

    iframe.addEventListener('load', finish, { once: true });
    if (iframe.contentDocument?.readyState === 'complete') {
      finish();
    }
  });

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 150);
  });
}

function scheduleNativePrintIframeCleanup(contentWin: Window): void {
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    window.clearTimeout(fallbackTimer);
    contentWin.removeEventListener('afterprint', onAfterPrint);
    document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();
  };

  const onAfterPrint = (): void => cleanup();
  const fallbackTimer = window.setTimeout(() => cleanup(), IOS_PRINT_IFRAME_CLEANUP_MS);
  contentWin.addEventListener('afterprint', onAfterPrint);
}

async function mountNativePrintHtmlIframe(html: string): Promise<HTMLIFrameElement> {
  document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = NATIVE_PRINT_IFRAME_ID;
  iframe.setAttribute(
    'style',
    'position:fixed;left:-10000px;top:0;width:8.5in;height:11in;border:0;visibility:hidden'
  );
  iframe.setAttribute('title', 'Print preview');
  document.body.appendChild(iframe);
  iframe.srcdoc = html;
  await waitForPrintIframeReady(iframe);
  return iframe;
}

/** iOS memorization duplex: WKWebView print instead of UIMarkupTextPrintFormatter. */
async function printHtmlOnIosViaWebKitIframe(html: string, title: string): Promise<void> {
  const iframe = await mountNativePrintHtmlIframe(html);
  const contentWin = iframe.contentWindow;
  if (!contentWin) {
    document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();
    throw new Error('Print iframe unavailable');
  }

  if (title && iframe.contentDocument) {
    iframe.contentDocument.title = title;
  }

  scheduleNativePrintIframeCleanup(contentWin);

  try {
    await Printer.printIframe({
      selector: `#${NATIVE_PRINT_IFRAME_ID}`,
      name: title,
    });
  } catch (bridgeError) {
    try {
      contentWin.focus();
      contentWin.print();
    } catch (printError) {
      document.getElementById(NATIVE_PRINT_IFRAME_ID)?.remove();
      throw printError ?? bridgeError;
    }
  }
}

/** Share or save print HTML on native app via @capgo/capacitor-printer. */
export async function sharePrintHtmlOnNativeApp(
  html: string,
  filename: string,
  title: string,
  options: SharePrintHtmlNativeOptions = {}
): Promise<void> {
  try {
    const platform = getCapacitorPlatform();
    if (platform !== 'ios' && platform !== 'android') {
      return;
    }

    try {
      if (platform === 'ios' && options.iosWebKitPrint) {
        await printHtmlOnIosViaWebKitIframe(html, title);
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
