import type { SupabaseClientOptions } from '@supabase/supabase-js';
import { resolveSupabaseAuthClientOptions } from './supabase-auth-storage';

type ClientOptions = SupabaseClientOptions<'public'>;

export function buildSupabaseClientOptions(
  supabaseUrl: string,
  getClientVersion: () => string,
  fetchWithNativeCompat: (
    input: URL | RequestInfo,
    options?: RequestInit
  ) => Promise<Response>
): ClientOptions {
  const authStorage = resolveSupabaseAuthClientOptions(supabaseUrl);

  return {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: authStorage.storage,
      storageKey: authStorage.storageKey,
      lock: async <R>(
        _name: string,
        _acquireTimeout: number,
        fn: () => Promise<R>
      ): Promise<R> => await fn(),
    },
    global: {
      headers: {
        'x-client-info': `supabase-js/${getClientVersion()}`,
      },
      fetch: (input: URL | RequestInfo, options?: RequestInit) =>
        fetchWithNativeCompat(input, options),
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  };
}
