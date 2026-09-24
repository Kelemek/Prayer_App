import { describe, expect, it } from 'vitest';
import {
  isAllowedLogoMimeType,
  logoCompressionFormat,
  logoNeedsResize,
  LOGO_MAX_HEIGHT,
  LOGO_MAX_WIDTH,
} from './branding-logo-spec';

describe('branding-logo-spec', () => {
  it('accepts allowed mime types', () => {
    expect(isAllowedLogoMimeType('image/png')).toBe(true);
    expect(isAllowedLogoMimeType('image/gif')).toBe(false);
  });

  it('maps mime types to compression formats', () => {
    expect(logoCompressionFormat('image/png')).toBe('png');
    expect(logoCompressionFormat('image/webp')).toBe('webp');
    expect(logoCompressionFormat('image/jpeg')).toBe('jpeg');
  });

  it('detects when resize is needed', () => {
    expect(logoNeedsResize(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT)).toBe(false);
    expect(logoNeedsResize(LOGO_MAX_WIDTH + 1, 10)).toBe(true);
    expect(logoNeedsResize(10, LOGO_MAX_HEIGHT + 1)).toBe(true);
  });
});
