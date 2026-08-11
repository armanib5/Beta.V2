"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/auth-errors";

const ADMIN_EMAIL = "citypinned@gmail.com";
const REMEMBER_KEY = "citypinned_login_remember";

type Mode = "password" | "pin";

export function VendorLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remembers which mode and identifier were used last, so a returning
  // vendor/admin doesn't retype it every time — never the password/PIN
  // itself, just what to log in as.
  useEffect(() => {
    // localStorage only exists post-hydration on a static export — this
    // intentionally re-renders once the remembered value is known.
    try {
      const raw = window.localStorage.getItem(REMEMBER_KEY);
      if (!raw) return;
      const remembered = JSON.parse(raw) as { mode: Mode; email?: string; businessId?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(remembered.mode);
      if (remembered.email) setEmail(remembered.email);
      if (remembered.businessId) setBusinessId(remembered.businessId);
    } catch {
      // ignore
    }
  }, []);

  function remember(next: { mode: Mode; email?: string; businessId?: string }) {
    try {
      window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      // signInWithPassword leaves any pre-existing session untouched on
      // failure - without this, a stale session from a previous login
      // (shared/kiosk device) can make a failed attempt here look like
      // "already logged in" as whoever was signed in before.
      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(friendlyErrorMessage(signInError));
        return;
      }
      remember({ mode: "password", email });
      router.push("/vendor/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const resolvedEmail = businessId.trim()
        ? `${businessId.trim().toLowerCase()}@vendor.citypinned.app`
        : ADMIN_EMAIL;
      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: pin,
      });
      if (signInError) {
        setError(friendlyErrorMessage(signInError));
        return;
      }
      remember({ mode: "pin", businessId });
      router.push(businessId.trim() ? "/vendor/dashboard" : "/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex rounded-full border border-slate-300 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-full py-1.5 ${mode === "password" ? "bg-slate-900 text-white" : "text-slate-600"}`}
        >
          Email &amp; Password
        </button>
        <button
          type="button"
          onClick={() => setMode("pin")}
          className={`flex-1 rounded-full py-1.5 ${mode === "pin" ? "bg-slate-900 text-white" : "text-slate-600"}`}
        >
          PIN
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log In"}
          </button>
          <p className="text-center text-sm">
            <Link href="/vendor/forgot-password" className="font-semibold text-slate-600 underline hover:text-slate-900">
              Forgot password?
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handlePinSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Business ID (leave blank for admin)"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log In with PIN"}
          </button>
          <p className="text-center text-xs text-slate-500">
            Forgot your PIN? There&rsquo;s no self-service reset for it — ask an admin to issue you a new one.
          </p>
        </form>
      )}
    </div>
  );
}
