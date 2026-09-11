import { describe, expect, it } from 'vitest';
import { buildPrintBookletFrontQrFooterHtml } from './print-booklet-chrome';

describe('print-booklet-chrome', () => {
  it('uses tenant name and generic copy (no CP meeting time text)', () => {
    const html = buildPrintBookletFrontQrFooterHtml('https://example.com/qr.png', 'Acme Church');

    expect(html).toContain('Acme Church');
    expect(html).toContain('Scan for information about our prayer app');
    expect(html).not.toContain('overflow room');
    expect(html).not.toContain('6 - 6:25');
  });
});
