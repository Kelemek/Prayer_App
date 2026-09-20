import { describe, expect, it, vi } from 'vitest';
import {
  injectPrintDialogScript,
  isLikelySafariBrowser,
  schedulePrintOnWindow,
  writeHtmlToPopupAndPrint,
} from './print-popup-window';

describe('print-popup-window', () => {
  it('isLikelySafariBrowser detects Safari vs Chromium', () => {
    expect(
      isLikelySafariBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
      )
    ).toBe(true);
    expect(
      isLikelySafariBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('injectPrintDialogScript adds auto-print script before body close', () => {
    const html = injectPrintDialogScript('<html><body>test</body></html>');
    expect(html).toContain('__prayerAppPrintScheduled');
    expect(html).toContain('window.print()');
    expect(html.indexOf('window.print()')).toBeLessThan(html.indexOf('</body>'));
  });

  it('writeHtmlToPopupAndPrint injects script for Chromium and focuses', () => {
    const print = vi.fn();
    const focus = vi.fn();
    const doc = {
      readyState: 'complete',
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    const win = {
      document: doc,
      focus,
      print,
      addEventListener: vi.fn(),
    } as unknown as Window;

    const chromeUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0 Safari/537.36';
    vi.stubGlobal('navigator', { userAgent: chromeUa });

    writeHtmlToPopupAndPrint(win, '<html><body>test</body></html>');

    const written = doc.write.mock.calls[0][0] as string;
    expect(written).toContain('__prayerAppPrintScheduled');
    expect(focus).toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('writeHtmlToPopupAndPrint omits script on Safari and schedules opener print', () => {
    const print = vi.fn();
    const focus = vi.fn();
    const doc = {
      readyState: 'complete',
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    const win = {
      document: doc,
      focus,
      print,
      addEventListener: vi.fn(),
    } as unknown as Window;

    const safariUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
    vi.stubGlobal('navigator', { userAgent: safariUa });

    writeHtmlToPopupAndPrint(win, '<html><body>test</body></html>');

    const written = doc.write.mock.calls[0][0] as string;
    expect(written).not.toContain('__prayerAppPrintScheduled');
    expect(focus).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('schedulePrintOnWindow waits for load when document is not complete', () => {
    const print = vi.fn();
    const focus = vi.fn();
    const listeners: Record<string, () => void> = {};
    const win = {
      document: { readyState: 'loading' },
      focus,
      print,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
    } as unknown as Window;

    schedulePrintOnWindow(win);
    expect(win.addEventListener).toHaveBeenCalledWith('load', expect.any(Function), {
      once: true,
    });
    listeners['load']();
  });
});
