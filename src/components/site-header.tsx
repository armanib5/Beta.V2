"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/site";
import { MobileNav } from "@/components/mobile-nav";
import type { Vendor } from "@/lib/types";

// Next.js routes (client-side navigation via next/link).
const appLinks = [
  { href: "/vendors", label: "Vendor Directory" },
  { href: "/calendar", label: "Calendar" },
  { href: "/#pricing", label: "Become a Vendor" },
];

// The ported V1 BayPinned pages — plain static HTML living in public/,
// outside the Next app, so these need a real page load (not next/link's
// client-side routing) and the basePath prefixed by hand.
const boardLinks = [
  { href: `${BASE_PATH}/board/`, label: "The Board" },
  { href: `${BASE_PATH}/map/`, label: "The Map" },
  { href: `${BASE_PATH}/pins/`, label: "Add a Pin" },
];

type Profile = Pick<Vendor, "business_name" | "logo_url"> | null;

export function SiteHeader() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("vendors")
        .select("business_name,logo_url")
        .eq("id", userId)
        .maybeSingle<Profile>();
      setProfile(data ?? null);
    }

    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
      if (data.user) loadProfile(data.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span aria-hidden="true">📍</span>
          CityPinned
        </Link>

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
  );
}
