"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { BASE_PATH } from "@/lib/site";
import { MobileNav } from "@/components/mobile-nav";
import type { Vendor } from "@/lib/types";

const SESSION_HINT_KEY = "citypinned_session_hint";

/** The V1 static Board/Map pages use a completely different Supabase
 * client (plain supabase-js via CDN, localStorage-based sessions) than
 * this app (@supabase/ssr, cookie-based sessions) — the two can't read
 * each other's session directly. This writes a small, non-authoritative
 * "hint" to localStorage (shared across same-origin pages) so the Board's
 * nav can show "My Dashboard"/"Admin" instead of always showing "Vendor
 * Login" even when already signed in. Real authorization still happens
 * independently wherever it matters (RLS, checkIsAdmin on /admin/*). */
function writeSessionHint(signedIn: boolean, businessName?: string | null, isAdmin?: boolean) {
  try {
    if (!signedIn) {
      window.localStorage.removeItem(SESSION_HINT_KEY);
      return;
    }
    window.localStorage.setItem(
      SESSION_HINT_KEY,
      JSON.stringify({ signedIn: true, businessName: businessName ?? null, isAdmin: Boolean(isAdmin) }),
    );
  } catch {
    // localStorage unavailable (private mode edge cases) — nav just falls back to "Vendor Login"
  }
}

// Next.js routes (client-side navigation via next/link).
const appLinks = [
  { href: "/directory", label: "Directory" },
  { href: "/calendar", label: "Calendar" },
  { href: "/#pricing", label: "Become a Vendor" },
];

// The ported V1 BayPinned pages — plain static HTML living in public/,
// outside the Next app, so these need a real page load (not next/link's
// client-side routing) and the basePath prefixed by hand.
const boardLinks = [
  { href: `${BASE_PATH}/board/`, label: "The Board" },
  { href: `${BASE_PATH}/map/`, label: "The Map" },
  { href: `${BASE_PATH}/pins/`, label: "Manage My Pin" },
];

type Profile = Pick<Vendor, "business_name" | "logo_url"> | null;

export function SiteHeader() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Tracked separately (not just a summed pendingCount) so the badge can
  // route to whichever admin page actually has something to resolve -
  // pending flyers are only reviewable on /admin/flyers, not
  // /admin/vendors, and sending the badge to the wrong page for that case
  // means the count never drops and the badge just reappears every poll.
  const [pendingVendorCount, setPendingVendorCount] = useState(0);
  const [pendingFlyerCount, setPendingFlyerCount] = useState(0);
  const [pendingBoostCount, setPendingBoostCount] = useState(0);
  const pendingCount = pendingVendorCount + pendingFlyerCount + pendingBoostCount;
  const pendingHref = pendingVendorCount > 0 || pendingBoostCount > 0 ? "/admin/vendors" : "/admin/flyers";

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("vendors")
        .select("business_name,logo_url")
        .eq("id", userId)
        .maybeSingle<Profile>();
      setProfile(data ?? null);
      const admin = await checkIsAdmin(supabase);
      setIsAdmin(admin);
      writeSessionHint(true, data?.business_name, admin);
    }

    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
      if (data.user) loadProfile(data.user.id);
      else writeSessionHint(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      if (session?.user) loadProfile(session.user.id);
      else {
        setProfile(null);
        setIsAdmin(false);
        writeSessionHint(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // The site-wide "needs approval" badge next to the CityPinned logo -
  // only the admin account ever sees this, since it's gated on isAdmin.
  // Polls every 45s so it stays live while the admin is parked on any
  // page (Board/Map/Directory/wherever), not just on refresh.
  useEffect(() => {
    // Not resetting pendingCount to 0 here on purpose - the badge only
    // ever renders while isAdmin is also true, so a stale nonzero count
    // sitting unused in state after sign-out is harmless, and avoids a
    // synchronous setState-in-effect on every non-admin render.
    if (!isAdmin) return;
    const supabase = createClient();
    let cancelled = false;
    async function loadPending() {
      const [{ count: pendingVendors }, { count: pendingFlyers }, { count: boostRequests }] = await Promise.all([
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("lov_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("vendors").select("id", { count: "exact", head: true }).not("boost_requested_at", "is", null).eq("is_top10", false),
      ]);
      if (cancelled) return;
      setPendingVendorCount(pendingVendors ?? 0);
      setPendingFlyerCount(pendingFlyers ?? 0);
      setPendingBoostCount(boostRequests ?? 0);
    }
    loadPending();
    const interval = setInterval(loadPending, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  return (
    <>
    {isAdmin && pendingCount > 0 && (
      <Link
        href={pendingHref}
        title={`${pendingCount} waiting on approval — click to review`}
        className="approval-blink fixed bottom-4 right-4 z-[999] flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white shadow-lg ring-4 ring-white print:hidden"
      >
        {pendingCount}
      </Link>
    )}
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span aria-hidden="true">📍</span>
            CityPinned
          </Link>
          {isAdmin && pendingCount > 0 && (
            <Link
              href={pendingHref}
              title={`${pendingCount} waiting on approval`}
              className="approval-blink flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
            >
              {pendingCount}
            </Link>
          )}
          {/* In normal flow next to the logo (not absolutely centered over
              the header), so it can never sit on top of a nav link at any
              viewport width - only shown at xl+ so it stays off tablets. */}
          <span className="hidden rounded-full border border-amber-400 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 xl:inline-block">
            Beta V2
          </span>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {boardLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              {link.label}
            </a>
          ))}
          {appLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin"
            title="CityPinned Admin"
            className="text-lg hover:opacity-70"
          >
            🔒
          </Link>
          <Link
            href={isSignedIn ? "/vendor/dashboard" : "/vendor/login"}
            className="flex items-center gap-2 rounded-full bg-slate-900 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {isSignedIn ? (
              <>
                {profile?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary vendor-uploaded URLs
                  <img src={profile.logo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs">
                    {(profile?.business_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
                {profile?.business_name ?? "My Dashboard"}
              </>
            ) : (
              "Vendor Login"
            )}
          </Link>
        </nav>

        <MobileNav links={[...boardLinks, ...appLinks]} isSignedIn={isSignedIn} profile={profile} />
      </div>
    </header>
    </>
  );
}
