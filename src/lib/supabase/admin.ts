import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role Supabase client — bypasses RLS. Server-only (Stripe webhook,
 * checkout route). Never import this from a Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
