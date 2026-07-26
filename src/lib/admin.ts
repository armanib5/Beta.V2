import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-only admin check. There's no backend to trust here — this just
 * asks Postgres "is this signed-in user in the `admins` table?" via RLS
 * (a user can only ever see their own `admins` row), and every admin write
 * (booths, vendor approval) is independently re-enforced by its own RLS
 * policy. This function is a UX convenience, not the security boundary.
 */
export async function checkIsAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();
  return Boolean(data);
}
