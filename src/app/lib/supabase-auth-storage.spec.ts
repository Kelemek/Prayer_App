import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSupabaseAuthStorageKey,
  resolveSupabaseAuthClientOptions,
} from './supabase-auth-storage';
import { shouldUseCookieParentDomain } from './tenant-host';
import { createChunkedCookieStorage } from './chunked-cookie-storage';

vi.mock('../../environments/environment', () => ({
  environment: {
    cookieParentDomain: '.example.com',
    tenantHostSuffix: '.prayer.example.com',
  },
}));

vi.mock('./tenant-host', () => ({
  shouldUseCookieParentDomain: vi.fn(() => false),
}));

const cookieStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock('./chunked-cookie-storage', () => ({
  createChunkedCookieStorage: vi.fn(() => cookieStorage),
}));

describe('getSupabaseAuthStorageKey', () => {
  it('derives the storage key from the Supabase project hostname', () => {
    expect(getSupabaseAuthStorageKey('https://abc123.supabase.co')).toBe(
      'sb-abc123-auth-token'
    );
  });

  it('falls back when the URL is invalid', () => {
    expect(getSupabaseAuthStorageKey('not-a-url')).toBe('sb-local-auth-token');
  });
});

describe('resolveSupabaseAuthClientOptions', () => {
  afterEach(() => {
    vi.mocked(shouldUseCookieParentDomain).mockReturnValue(false);
  });

  it('uses localStorage on web hosts without cookie parent sharing', () => {
    const options = resolveSupabaseAuthClientOptions('https://proj.supabase.co');
    expect(options.storageKey).toBe('sb-proj-auth-token');
    expect(options.storage).toBe(window.localStorage);
  });

  it('uses chunked cookie storage on tenant suffix hosts', () => {
    vi.mocked(shouldUseCookieParentDomain).mockReturnValue(true);
    const options = resolveSupabaseAuthClientOptions('https://proj.supabase.co');
    expect(createChunkedCookieStorage).toHaveBeenCalledWith(
      'sb-proj-auth-token',
      { cookieParentDomain: '.example.com' }
    );
    expect(options.storage).toBe(cookieStorage);
  });

  it('falls back to in-memory storage when localStorage is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      configurable: true,
    });

    const options = resolveSupabaseAuthClientOptions('https://proj.supabase.co');
    options.storage.setItem('k', 'v');
    expect(options.storage.getItem('k')).toBe('v');
    options.storage.removeItem('k');
    expect(options.storage.getItem('k')).toBeNull();

    if (descriptor) {
      Object.defineProperty(window, 'localStorage', descriptor);
    }
  });
});
