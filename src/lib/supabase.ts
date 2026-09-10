import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { buildSupabaseClientOptions } from '../app/lib/supabase-client-options';

// Create a single supabase client for interacting with the database
export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabasePublishableKey,
  buildSupabaseClientOptions(
    environment.supabaseUrl,
    () => 'standalone',
    (input, options) => fetch(input, options)
  )
);
