import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Printer } from '@capgo/capacitor-printer';
import { isPrintNativeApp, sharePrintHtmlOnNativeApp } from './print-native';

vi.mock('@capgo/capacitor-printer', () => ({
  Printer: {
    printHtml: vi.fn(),
  },
}));

describe('print-native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as { Capacitor?: unknown }).Capacitor;
    window.alert = vi.fn();
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

  it('isPrintNativeApp is false on web', () => {
    expect(isPrintNativeApp()).toBe(false);
  });

  it('isPrintNativeApp is false when logging throws', () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('log fail');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(isPrintNativeApp()).toBe(false);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('isPrintNativeApp is false when getPlatform throws', () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => {
        throw new Error('platform');
      },
    };
    expect(isPrintNativeApp()).toBe(false);
  });

  it('isPrintNativeApp is true on iOS', () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    expect(isPrintNativeApp()).toBe(true);
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

  it('does not alert when the user cancels printing', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'ios',
    };
    vi.mocked(Printer.printHtml).mockRejectedValue(new Error('User cancelled'));
    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Title');

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('does not alert on cancelled errors in the outer handler', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => {
        throw new Error('User cancelled');
      },
    };

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Title');

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('alerts when Capacitor platform detection throws', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => {
        throw new Error('boom');
      },
    };

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Title');

    expect(window.alert).toHaveBeenCalledWith('Error: boom');
  });

  it('no-ops on web when Capacitor platform is not mobile', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'web',
    };
    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Title');
    expect(Printer.printHtml).not.toHaveBeenCalled();
  });

  it('alerts on unexpected printer errors', async () => {
    (window as { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'android',
    };
    vi.mocked(Printer.printHtml).mockRejectedValue(new Error('Printer offline'));

    await sharePrintHtmlOnNativeApp('<html></html>', 'out.html', 'Title');

    expect(window.alert).toHaveBeenCalledWith(
      'Failed to open print dialog: Printer offline'
    );
  });
});
