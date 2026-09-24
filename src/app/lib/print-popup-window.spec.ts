import { describe, expect, it, vi } from 'vitest';
import {
  injectPrintDialogScript,
  isLikelySafariBrowser,
  schedulePrintOnWindow,
  writeHtmlToPopupAndPrint,
} from './print-popup-window';

describe('print-popup-window', () => {
  it('injectPrintDialogScript is a no-op when script already present', () => {
    const html = '<html><body>__prayerAppPrintScheduled</body></html>';
    expect(injectPrintDialogScript(html)).toBe(html);
  });

  it('injectPrintDialogScript appends script when body tag missing', () => {
    const html = '<div>fragment</div>';
    expect(injectPrintDialogScript(html)).toContain('window.print()');
  });

  it('isLikelySafariBrowser detects Safari vs Chrome', () => {
    expect(
      isLikelySafariBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
      )
    ).toBe(true);
    expect(
      isLikelySafariBrowser(
        'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('injectPrintDialogScript adds auto-print script before body close', () => {
    const html = injectPrintDialogScript('<html><body>test</body></html>');
    expect(html).toContain('__prayerAppPrintScheduled');
    expect(html).toContain('window.print()');
    expect(html).toContain("addEventListener('load'");
    expect(html.indexOf('window.print()')).toBeLessThan(html.indexOf('</body>'));
  });

  it('writeHtmlToPopupAndPrint writes document with print script and focuses', () => {
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

    writeHtmlToPopupAndPrint(win, '<html><body>test</body></html>');

    expect(doc.open).toHaveBeenCalled();
    const written = doc.write.mock.calls[0][0] as string;
    expect(written).toContain('__prayerAppPrintScheduled');
    expect(doc.close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
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

  it('schedulePrintOnWindow prints immediately when document is complete', () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    const win = {
      document: { readyState: 'complete' },
      focus: vi.fn(),
      print,
      addEventListener: vi.fn(),
    } as unknown as Window;

    schedulePrintOnWindow(win, 0);
    vi.runAllTimers();
    expect(print).toHaveBeenCalled();
    vi.useRealTimers();
    raf.mockRestore();
  });
});
