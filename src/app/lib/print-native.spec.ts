import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Printer } from '@capgo/capacitor-printer';
import { sharePrintHtmlOnNativeApp } from './print-native';

vi.mock('@capgo/capacitor-printer', () => ({
  Printer: {
    printHtml: vi.fn(),
  },
}));

describe('print-native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  afterEach(() => {
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it('sharePrintHtmlOnNativeApp calls printHtml on iOS', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    vi.mocked(Printer.printHtml).mockResolvedValue();

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Prayer List');

    expect(Printer.printHtml).toHaveBeenCalledWith({
      name: 'Prayer List',
      html: '<html></html>',
    });
  });

  it('sharePrintHtmlOnNativeApp calls printHtml on Android', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'android',
    };
    vi.mocked(Printer.printHtml).mockResolvedValue();

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Verse cards');

    expect(Printer.printHtml).toHaveBeenCalledWith({
      name: 'Verse cards',
      html: '<html></html>',
    });
  });
});
