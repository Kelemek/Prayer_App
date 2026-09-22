import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Printer } from '@capgo/capacitor-printer';
import {
  NATIVE_PRINT_IFRAME_ID,
  mountNativePrintHtmlIframe,
  printFromNativeHtmlIframe,
  removeNativePrintHtmlIframe,
  sharePrintHtmlOnNativeApp,
} from './print-native';

vi.mock('@capgo/capacitor-printer', () => ({
  Printer: {
    printHtml: vi.fn(),
    printIframe: vi.fn(),
  },
}));

describe('print-native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeNativePrintHtmlIframe();
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'web',
    };
  });

  afterEach(() => {
    removeNativePrintHtmlIframe();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it('mountNativePrintHtmlIframe writes HTML into a hidden iframe', async () => {
    const iframe = await mountNativePrintHtmlIframe(
      '<!DOCTYPE html><html><body><p>duplex</p></body></html>'
    );
    expect(iframe.id).toBe(NATIVE_PRINT_IFRAME_ID);
    expect(iframe.contentDocument?.body.textContent).toContain('duplex');
    removeNativePrintHtmlIframe();
    expect(document.getElementById(NATIVE_PRINT_IFRAME_ID)).toBeNull();
  });

  it('printFromNativeHtmlIframe resolves after printIframe without waiting for afterprint', async () => {
    const iframe = await mountNativePrintHtmlIframe(
      '<!DOCTYPE html><html><body><p>print me</p></body></html>'
    );

    vi.mocked(Printer.printIframe).mockResolvedValue();

    await printFromNativeHtmlIframe(iframe, 'Verse cards');

    expect(Printer.printIframe).toHaveBeenCalledWith({
      selector: `#${NATIVE_PRINT_IFRAME_ID}`,
      name: 'Verse cards',
    });
    // Iframe kept for iOS print rendering until afterprint or timeout.
    expect(document.getElementById(NATIVE_PRINT_IFRAME_ID)).toBeTruthy();
    removeNativePrintHtmlIframe();
  });

  it('sharePrintHtmlOnNativeApp does not use capacitor printHtml on iOS', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    vi.mocked(Printer.printIframe).mockResolvedValue();

    await sharePrintHtmlOnNativeApp(
      '<!DOCTYPE html><html><body><div class="print-page"></div></body></html>',
      'cards.html',
      'Verse cards'
    );

    expect(Printer.printIframe).toHaveBeenCalled();
    expect(Printer.printHtml).not.toHaveBeenCalled();
    removeNativePrintHtmlIframe();
  });

  it('sharePrintHtmlOnNativeApp uses printHtml on Android', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'android',
    };
    vi.mocked(Printer.printHtml).mockResolvedValue();

    await sharePrintHtmlOnNativeApp('<html></html>', 'cards.html', 'Verse cards');

    expect(Printer.printHtml).toHaveBeenCalledWith({
      name: 'Verse cards',
      html: '<html></html>',
    });
    expect(Printer.printIframe).not.toHaveBeenCalled();
  });
});
