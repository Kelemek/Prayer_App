import { describe, expect, it } from 'vitest';
import { getPrintBookletAppIconUrl, resolvePrintAssetUrl } from './print-asset-url';

describe('resolvePrintAssetUrl', () => {
  it('returns empty string for blank input', () => {
    expect(resolvePrintAssetUrl('   ')).toBe('');
  });

  it('preserves absolute http(s) and data URLs', () => {
    expect(resolvePrintAssetUrl('https://cdn.example/logo.png')).toBe(
      'https://cdn.example/logo.png'
    );
    expect(resolvePrintAssetUrl('data:image/png;base64,abc')).toContain('data:');
  });

  it('prefixes same-origin paths with window origin', () => {
    expect(resolvePrintAssetUrl('/icons/icon.png')).toBe(
      `${window.location.origin}/icons/icon.png`
    );
  });

  it('exposes booklet icon path', () => {
    expect(getPrintBookletAppIconUrl()).toContain('/icons/icon-512.png');
  });
});
