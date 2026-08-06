"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import { friendlyErrorMessage } from "@/lib/auth-errors";
import { BASE_PATH } from "@/lib/site";
import type { VendorHubType } from "@/lib/types";
import { CheckoutTermsCheckbox, CheckoutTermsNotice, EventLiabilityCheckbox, PlatformFeeNotice } from "@/components/checkout-terms";

const SLUG_RETRY_ATTEMPTS = 5;

export function VendorSignupForm({
  defaultHubType,
  tierId,
}: {
  defaultHubType?: VendorHubType;
  tierId?: string;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinct from `error` (red/alarming) - this is the expected, successful
  // outcome of every signup while email confirmation is required, and used
  // to be shown via setError(), making a working signup look identical to
  // a failed one.
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Every account (free or paid) needs the event non-host/liability
    // acknowledgment; only a paid signup (a tier was picked) also needs
    // the sales-final one. Re-checked here even though the button is
    // already disabled until both are true, so the guard can't be
    // bypassed by submitting the form directly.
    if (!liabilityAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    if (tierId && !termsAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // Confirmation email links back here specifically (not whatever
        // the project's default Site URL happens to be) - this page
        // already has the "finish your profile" completion flow for a
        // just-confirmed account with no vendor row yet. Same pattern
        // vendor-forgot-password/page.tsx already uses for its own
        // reset-password redirect.
        options: {
          emailRedirectTo: `${window.location.origin}${BASE_PATH}/vendor/dashboard`,
          // Carries hub_type across the confirmation-email gap - without
          // this, a Venue/Host Hub signup that hits the "no session yet"
          // path below would silently become a plain vendor account once
          // /vendor/dashboard finishes creating its row after confirmation,
          // since nothing else remembers which kind of signup this was.
          data: defaultHubType ? { hub_type: defaultHubType } : undefined,
        },
      });
      if (signUpError) {
        // TEMPORARY - remove once the current signup rate-limit issue is
        // resolved. friendlyErrorMessage() only shows a mapped, generic
        // message to the user; this exposes the raw code/status/message
        // Supabase Auth actually returned, in the dev console only, so a
        // real 429 can't be confused with anything else client-side.
        if (process.env.NODE_ENV !== "production") {
          console.error("[vendor-signup-form] signUp() failed at Supabase Auth (client -> /auth/v1/signup directly, no worker/API involved):", {
            code: signUpError.code,
            status: signUpError.status,
            message: signUpError.message,
          });
        }
        setError(friendlyErrorMessage(signUpError));
        return;
      }

      const user = data.user;
      const session = data.session;
      if (!user || !session) {
        // The expected outcome with email confirmation required -
        // signUp() creates the auth user but issues no session until the
        // link is clicked, so there's nothing to authenticate the
        // vendors-row insert below as yet (RLS requires auth.uid() = id).
        // /vendor/dashboard finishes it once a real session exists.
        setNotice("Account created! Check your email to confirm it, then log in to finish setting up your profile.");
        return;
      }

      const baseSlug = slugify(businessName);
      let created = false;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < SLUG_RETRY_ATTEMPTS && !created; attempt++) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { error: insertError } = await supabase.from("vendors").insert({
          id: user.id,
          slug,
          business_name: businessName,
          contact_email: email,
          status: "pending",
          ...(defaultHubType ? { hub_type: defaultHubType } : {}),
        });

        if (!insertError) {
          created = true;
        } else if (insertError.code === "23505") {
          lastError = insertError.message; // slug collision — retry with a suffix
        } else {
          setError(friendlyErrorMessage(insertError));
          return;
        }
      }

      if (!created) {
        setError(lastError ?? "Could not create your vendor profile. Please try again.");
        return;
      }

      // Timestamped, server-observed-IP record of the event non-host/
      // liability acknowledgment for this new account - failure here
      // shouldn't block a successful signup, only best-effort logged.
      // session is guaranteed non-null here (the "no session yet" branch
      // above already returned otherwise), so its access_token is this
      // brand-new account's own - exactly who the worker route now
      // requires the caller to be.
      fetch("/api/log-terms-agreement", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vendor_id: user.id }),
      }).catch(() => {});

      if (tierId) {
        try {
          const res = await fetch("/api/create-checkout-session", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ vendor_id: user.id, tier_id: tierId, terms_accepted: termsAccepted }),
          });
          const data: { url?: string; error?: string } = await res.json();
          if (res.ok && data.url) {
            window.location.href = data.url;
            return;
          }
          // Account exists either way — stay put and show it, rather than
          // navigating away before the message is even visible. Boost/
          // Feature on the dashboard offers the same checkout again.
          setCheckoutError(
            data.error ?? "Your account was created, but we couldn't start checkout. You can pay from your dashboard instead.",
          );
          return;
        } catch {
          setCheckoutError("Your account was created, but we couldn't reach payment. You can pay from your dashboard instead.");
          return;
        }
      }

      router.push("/vendor/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (notice) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ {notice}
        </p>
        <Link
          href="/vendor/login"
          className="block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
        >
          Go to Log In
        </Link>
      </div>
    );
  }

  if (checkoutError) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {checkoutError}
        </p>
        <Link
          href="/vendor/dashboard"
          className="block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
        >
          Go to My Dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="text"
        required
        placeholder="Business name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
      <input
        type="password"
        required
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
      <input
        type="password"
        required
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {tierId && <PlatformFeeNotice />}
        {tierId && <CheckoutTermsNotice />}
        {tierId && <CheckoutTermsCheckbox id="signup-terms" checked={termsAccepted} onChange={setTermsAccepted} />}
        <EventLiabilityCheckbox id="signup-liability-terms" checked={liabilityAccepted} onChange={setLiabilityAccepted} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || (Boolean(tierId) && !termsAccepted) || !liabilityAccepted}
        className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? "Creating account…" : tierId ? "Secure Checkout" : "Create Vendor Login"}
      </button>
    </form>
  );
}
