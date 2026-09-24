import { describe, expect, it, vi } from 'vitest';
import {
  buildInfoQrImageSrc,
  buildPrintInfoFooterHtml,
  getGlobalFetch,
  getPrintInfoFooterStyles,
  resolvePrintInfoPageUrl,
  tryFetchImageAsDataUrl,
} from './print-info-footer';

describe('print-info-footer', () => {
  it('exposes footer styles and HTML', () => {
    expect(getPrintInfoFooterStyles()).toContain('.print-info-footer');
    const html = buildPrintInfoFooterHtml('https://example.com/qr.png');
    expect(html).toContain('Want to get the app?');
    expect(html).toContain('https://example.com/qr.png');
  });

  it('buildInfoQrImageSrc encodes the info URL', () => {
    const src = buildInfoQrImageSrc('https://church.example/info');
    expect(src).toContain(encodeURIComponent('https://church.example/info'));
  });

  it('resolvePrintInfoPageUrl prefers email base', () => {
    expect(resolvePrintInfoPageUrl('https://app.example/', 'https://origin.example')).toBe(
      'https://app.example/info'
    );
    expect(resolvePrintInfoPageUrl('', 'https://origin.example')).toBe(
      'https://origin.example/info'
    );
  });

  it('tryFetchImageAsDataUrl returns data URL on success', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([bytes], { type: 'image/png' }),
    });
    const dataUrl = await tryFetchImageAsDataUrl('https://cdn.example/logo.png');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(getGlobalFetch()).toBeTypeOf('function');
  });

  it('tryFetchImageAsDataUrl returns null on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    await expect(tryFetchImageAsDataUrl('https://cdn.example/x.png')).resolves.toBeNull();
  });
});
