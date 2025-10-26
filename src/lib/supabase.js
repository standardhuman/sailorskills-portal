/**
 * Supabase Client Utility
 * Simple replacement for shared package dependency
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Create Supabase client
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}
