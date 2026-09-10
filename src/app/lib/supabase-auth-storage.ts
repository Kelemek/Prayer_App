import { environment } from '../../environments/environment';
import { createChunkedCookieStorage } from './chunked-cookie-storage';
import { shouldUseCookieParentDomain } from './tenant-host';

/** Default Supabase auth storage key derived from project URL. */
export function getSupabaseAuthStorageKey(supabaseUrl: string): string {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split('.')[0] ?? 'local';
    return `sb-${projectRef}-auth-token`;
  } catch {
    return 'sb-local-auth-token';
  }
}

export interface SupabaseAuthClientOptions {
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  storageKey: string;
}

/** Resolve Supabase auth storage: shared cookie on tenant suffix hosts, else localStorage. */
export function resolveSupabaseAuthClientOptions(
  supabaseUrl: string
): SupabaseAuthClientOptions {
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const cookieParent = environment.cookieParentDomain?.trim() ?? '';
  const tenantSuffix = environment.tenantHostSuffix?.trim() ?? '';

  if (
    typeof window !== 'undefined' &&
    cookieParent &&
    tenantSuffix &&
    shouldUseCookieParentDomain(hostname, cookieParent, tenantSuffix)
  ) {
    return {
      storageKey,
      storage: createChunkedCookieStorage(storageKey, {
        cookieParentDomain: cookieParent,
      }),
    };
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return { storageKey, storage: window.localStorage };
  }

  const memory = new Map<string, string>();
  return {
    storageKey,
    storage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  };
}
