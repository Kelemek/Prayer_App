/**
 * Chunked cookie storage for Supabase auth sessions that exceed single-cookie size limits.
 * Uses document.cookie with Domain set to the configured parent domain.
 */

const CHUNK_META_KEY = '__chunk_count';
const CHUNK_SIZE = 3500;

export interface ChunkedCookieStorageOptions {
  cookieParentDomain: string;
  secure?: boolean;
}

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(';');
  for (const part of cookies) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeCookieValue(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function writeCookie(
  name: string,
  value: string,
  options: ChunkedCookieStorageOptions
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const domain = options.cookieParentDomain.startsWith('.')
    ? options.cookieParentDomain
    : `.${options.cookieParentDomain}`;
  const secure = options.secure ?? window.location.protocol === 'https:';
  const base = `path=/;domain=${domain};samesite=lax${secure ? ';secure' : ''}`;
  document.cookie = `${encodeURIComponent(name)}=${encodeCookieValue(value)};${base}`;
}

function deleteCookie(name: string, options: ChunkedCookieStorageOptions): void {
  if (typeof document === 'undefined') {
    return;
  }
  const domain = options.cookieParentDomain.startsWith('.')
    ? options.cookieParentDomain
    : `.${options.cookieParentDomain}`;
  const secure = options.secure ?? window.location.protocol === 'https:';
  const base = `path=/;domain=${domain};samesite=lax${secure ? ';secure' : ''};max-age=0`;
  document.cookie = `${encodeURIComponent(name)}=;${base}`;
}

export function createChunkedCookieStorage(
  key: string,
  options: ChunkedCookieStorageOptions
): {
  getItem: (itemKey: string) => string | null;
  setItem: (itemKey: string, value: string) => void;
  removeItem: (itemKey: string) => void;
} {
  const storageKey = key;

  const chunkKey = (index: number): string => `${storageKey}__${index}`;
  const metaKey = (): string => `${storageKey}__${CHUNK_META_KEY}`;

  const removeChunks = (): void => {
    const countRaw = readCookie(metaKey());
    const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
    if (Number.isFinite(count) && count > 0) {
      for (let i = 0; i < count; i += 1) {
        deleteCookie(chunkKey(i), options);
      }
    }
    deleteCookie(metaKey(), options);
    deleteCookie(storageKey, options);
  };

  return {
    getItem(itemKey: string): string | null {
      if (itemKey !== storageKey) {
        return null;
      }
      const direct = readCookie(storageKey);
      if (direct !== null) {
        return direct;
      }
      const countRaw = readCookie(metaKey());
      const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = readCookie(chunkKey(i));
        if (part === null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    },

    setItem(itemKey: string, value: string): void {
      if (itemKey !== storageKey) {
        return;
      }
      removeChunks();
      if (value.length <= CHUNK_SIZE) {
        writeCookie(storageKey, value, options);
        return;
      }
      const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < chunkCount; i += 1) {
        writeCookie(chunkKey(i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), options);
      }
      writeCookie(metaKey(), String(chunkCount), options);
    },

    removeItem(itemKey: string): void {
      if (itemKey !== storageKey) {
        return;
      }
      removeChunks();
    },
  };
}
