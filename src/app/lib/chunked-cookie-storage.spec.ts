import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChunkedCookieStorage } from './chunked-cookie-storage';

describe('createChunkedCookieStorage', () => {
  let jar: Map<string, string>;

  beforeEach(() => {
    jar = new Map();
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    });
    vi.spyOn(document, 'cookie', 'set').mockImplementation((value: string) => {
      const [pair] = value.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) return;
      const name = decodeURIComponent(pair.slice(0, eq));
      const raw = pair.slice(eq + 1);
      if (value.includes('max-age=0')) {
        jar.delete(name);
        return;
      }
      jar.set(name, decodeURIComponent(raw));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores and reads a small value in a single cookie', () => {
    const storage = createChunkedCookieStorage('sb-auth', {
      cookieParentDomain: 'example.com',
      secure: false,
    });
    storage.setItem('sb-auth', '{"access_token":"abc"}');
    expect(storage.getItem('sb-auth')).toBe('{"access_token":"abc"}');
    expect(storage.getItem('other-key')).toBeNull();
  });

  it('chunks large values across multiple cookies', () => {
    const storage = createChunkedCookieStorage('sb-large', {
      cookieParentDomain: 'example.com',
      secure: false,
    });
    const large = 'x'.repeat(3600);
    storage.setItem('sb-large', large);
    expect(storage.getItem('sb-large')).toBe(large);
  });

  it('removeItem clears stored values', () => {
    const storage = createChunkedCookieStorage('sb-remove', {
      cookieParentDomain: 'example.com',
      secure: false,
    });
    storage.setItem('sb-remove', 'value');
    storage.removeItem('sb-remove');
    expect(storage.getItem('sb-remove')).toBeNull();
  });
});
