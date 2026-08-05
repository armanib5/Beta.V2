/** Supabase Auth/Postgrest errors are precise but not written for an end
 * user (e.g. the raw code "over_email_send_rate_limit", or a bare
 * Postgres constraint message) — maps the ones that actually show up in
 * this app's signup/login flows to something a vendor can act on,
 * falling back to a generic message instead of ever surfacing internals
 * verbatim. */
export function friendlyErrorMessage(error: { message: string; code?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";

  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "We're sending confirmation emails faster than allowed right now — please wait a few minutes and try again.";
  }
  if (error.code === "user_already_exists" || /already registered|already exists/i.test(error.message)) {
    return 'An account with this email already exists — try logging in instead, or use "Forgot password" if you don\'t remember it.';
  }
  if (error.code === "email_address_invalid" || /invalid.*email/i.test(error.message)) {
    return "That doesn't look like a valid email address.";
  }
  if (error.code === "email_not_confirmed" || /email.*not.*confirmed/i.test(error.message)) {
    return "Please confirm your email first — check your inbox for the confirmation link we sent when you signed up.";
  }
  if (/password/i.test(error.message)) {
    return error.message; // Supabase's own password-requirement messages are already clear
  }
  return error.message || "Something went wrong. Please try again.";
}
