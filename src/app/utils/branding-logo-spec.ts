export const LOGO_MAX_WIDTH = 320;
export const LOGO_MAX_HEIGHT = 64;
export const LOGO_MAX_INPUT_BYTES = 2 * 1024 * 1024;

export const LOGO_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/webp',
  'image/jpeg',
] as const;

export const LOGO_ACCEPT_ATTR = 'image/png,image/webp,image/jpeg';

export const LOGO_UPLOAD_HELPER_TEXT =
  'PNG or WebP recommended (supports transparency). JPEG is also accepted but may show a solid background. Logos display up to 320×64 px in the header; larger images are resized automatically. Upload separate versions for light and dark backgrounds.';

export type LogoMimeType = (typeof LOGO_ALLOWED_MIME_TYPES)[number];

export function isAllowedLogoMimeType(type: string): type is LogoMimeType {
  return (LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

export function logoCompressionFormat(
  mimeType: LogoMimeType
): 'png' | 'webp' | 'jpeg' {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpeg';
    default: {
      const _exhaustive: never = mimeType;
      return _exhaustive;
    }
  }
}

export function logoNeedsResize(width: number, height: number): boolean {
  return width > LOGO_MAX_WIDTH || height > LOGO_MAX_HEIGHT;
}
