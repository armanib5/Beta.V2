"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";

export default function AdminHubPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then((isAdmin) => {
      if (cancelled) return;
      setStatus(isAdmin ? "ready" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">🔒 Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with the account listed in the <code>admins</code> table.
        </p>
        <Link
          href="/vendor/login"
          className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">🔒 CityPinned Admin</h1>
      <p className="mt-2 text-sm text-slate-600">Private — only visible to signed-in admins.</p>
      <div className="mt-8 space-y-3">
        <Link
          href="/admin/vendors"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Vendor Approvals</p>
          <p className="mt-1 text-sm text-slate-600">Approve/reject vendors, award Founding Vendor / Top 10.</p>
        </Link>
        <Link
          href="/admin/board"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Venue Board</p>
          <p className="mt-1 text-sm text-slate-600">Create events, booths, and vendor flyers.</p>
        </Link>
        <Link
          href="/admin/zones"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Event Zone Map</p>
          <p className="mt-1 text-sm text-slate-600">
            Interactive booth grid with fences, gates, exits, and vendor-area boundaries.
          </p>
        </Link>
        <Link
          href="/admin/legacy"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Legacy Dashboard</p>
          <p className="mt-1 text-sm text-slate-600">
            Every vendor and event, organized Live / Future / Past by city — tap any card for its full
            timestamped history.
          </p>
        </Link>
        <Link
          href="/admin/bookkeeping"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Bookkeeping</p>
          <p className="mt-1 text-sm text-slate-600">
            Every vendor, tier, and timestamp — by city and month, exportable as CSV or a printable PDF.
          </p>
        </Link>
      </div>
    </div>
  );
}
