"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import type { VendorHubType } from "@/lib/types";
import { CheckoutTermsCheckbox, CheckoutTermsNotice } from "@/components/checkout-terms";

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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
    // Only a paid signup (a tier was picked) needs terms acceptance — a
    // free account isn't a sale. Re-checked here even though the button
    // is already disabled until this is true, so the guard can't be
    // bypassed by submitting the form directly.
    if (tierId && !termsAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const user = data.user;
      if (!user || !data.session) {
        setError(
          "Account created — check your email to confirm it, then log in to finish setting up your profile.",
        );
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
          setError(insertError.message);
          return;
        }
      }

      if (!created) {
        setError(lastError ?? "Could not create your vendor profile. Please try again.");
        return;
      }

      if (tierId) {
        try {
          const res = await fetch("/api/create-checkout-session", {
            method: "POST",
            headers: { "content-type": "application/json" },
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
      {tierId && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <CheckoutTermsNotice />
          <CheckoutTermsCheckbox id="signup-terms" checked={termsAccepted} onChange={setTermsAccepted} />
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || (Boolean(tierId) && !termsAccepted)}
        className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? "Creating account…" : tierId ? "Secure Checkout" : "Create Vendor Login"}
      </button>
    </form>
  );
}
