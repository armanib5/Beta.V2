"use client";

import Link from "next/link";
import { useState } from "react";

export function MobileNav({
  links,
  isSignedIn,
}: {
  links: { href: string; label: string }[];
  isSignedIn: boolean;
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
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={isSignedIn ? "/vendor/dashboard" : "/vendor/login"}
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md bg-slate-900 px-3 py-3 text-center text-base font-semibold text-white"
            >
              {isSignedIn ? "My Dashboard" : "Vendor Login"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
