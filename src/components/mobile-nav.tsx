"use client";

import Link from "next/link";
import { useState } from "react";
import { BASE_PATH } from "@/lib/site";
import type { Vendor } from "@/lib/types";

export function MobileNav({
  links,
  isSignedIn,
  profile,
}: {
  links: { href: string; label: string }[];
  isSignedIn: boolean;
  profile?: Pick<Vendor, "business_name" | "logo_url"> | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 py-3 shadow-lg">
          <div className="flex flex-col gap-1">
            {links.map((link) =>
              link.href.startsWith(BASE_PATH) ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ),
            )}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              🔒 Admin
            </Link>
            <Link
              href={isSignedIn ? "/vendor/dashboard" : "/vendor/login"}
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-3 text-center text-base font-semibold text-white"
            >
              {isSignedIn ? (
                <>
                  {profile?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary vendor-uploaded URLs
                    <img src={profile.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs">
                      {(profile?.business_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  {profile?.business_name ?? "My Dashboard"}
                </>
              ) : (
                "Vendor Login"
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
