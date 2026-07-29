"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import type { VendorHubType } from "@/lib/types";

const SLUG_RETRY_ATTEMPTS = 5;

export function VendorSignupForm({ defaultHubType }: { defaultHubType?: VendorHubType }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      router.push("/vendor/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create Vendor Login"}
      </button>
    </form>
  );
}
