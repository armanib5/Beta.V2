"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/site";
import { MobileNav } from "@/components/mobile-nav";

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

export function SiteHeader() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
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
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {isSignedIn ? "My Dashboard" : "Vendor Login"}
          </Link>
        </nav>

        <MobileNav links={[...boardLinks, ...appLinks]} isSignedIn={isSignedIn} />
      </div>
    </header>
  );
}
