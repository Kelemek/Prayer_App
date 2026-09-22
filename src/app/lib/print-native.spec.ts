import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Printer } from '@capgo/capacitor-printer';
import { sharePrintHtmlOnNativeApp } from './print-native';

vi.mock('@capgo/capacitor-printer', () => ({
  Printer: {
    printHtml: vi.fn(),
    printIframe: vi.fn(),
  },
}));

describe('print-native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as { Capacitor?: unknown }).Capacitor;
    document.getElementById('prayer-app-native-print-frame')?.remove();
  });

  afterEach(() => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    document.getElementById('prayer-app-native-print-frame')?.remove();
  });

  it('sharePrintHtmlOnNativeApp calls printHtml on iOS by default', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    vi.mocked(Printer.printHtml).mockResolvedValue();

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Prayer List');

    expect(Printer.printHtml).toHaveBeenCalledWith({
      name: 'Prayer List',
      html: '<html></html>',
    });
    expect(Printer.printIframe).not.toHaveBeenCalled();
  });

  it('sharePrintHtmlOnNativeApp uses printIframe on iOS when iosWebKitPrint is set', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    vi.mocked(Printer.printIframe).mockResolvedValue();

    const html =
      '<!DOCTYPE html><html><body><div class="print-page sheet-front"></div></body></html>';
    await sharePrintHtmlOnNativeApp(html, 'cards.html', 'Verse cards', {
      iosWebKitPrint: true,
    });

    expect(Printer.printIframe).toHaveBeenCalledWith({
      selector: '#prayer-app-native-print-frame',
      name: 'Verse cards',
    });
    expect(Printer.printHtml).not.toHaveBeenCalled();
  });

  it('sharePrintHtmlOnNativeApp calls printHtml on Android', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'android',
    };
    vi.mocked(Printer.printHtml).mockResolvedValue();

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Verse cards', {
      iosWebKitPrint: true,
    });

    expect(Printer.printHtml).toHaveBeenCalledWith({
      name: 'Verse cards',
      html: '<html></html>',
    });
    expect(Printer.printIframe).not.toHaveBeenCalled();
  });
});
