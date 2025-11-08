/**
 * Supabase Client Utility
 * Uses local auth module with SSO configuration
 */

// Export the configured Supabase client instance (not a factory function)
export { supabase } from "../auth/auth.js";

// For backwards compatibility with code expecting createSupabaseClient
// This is the actual client instance, not a factory function
export { supabase as createSupabaseClient } from "../auth/auth.js";
