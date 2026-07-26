"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function VendorSignupForm({
  sessionId,
  initialEmail,
}: {
  sessionId: string;
  initialEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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

      if (!data.session) {
        setError(
          "Account created — check your email to confirm it, then log in to finish setting up your profile.",
        );
        return;
      }

      const claimRes = await fetch("/api/vendor/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        setError(claimData.error ?? "Could not link your payment to this account.");
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
