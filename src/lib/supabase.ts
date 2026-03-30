import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

// Create a single supabase client for interacting with the database
export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Bypass Navigator LockManager to prevent lock acquisition failures
      lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => await fn()
    }
  }
);
