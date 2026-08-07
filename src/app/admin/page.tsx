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
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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
          href="/admin/map-studio"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Map Studio</p>
          <p className="mt-1 text-sm text-slate-600">
            Add, edit, drag, and remove pins on the real map — with a live link to see exactly what the public sees.
          </p>
        </Link>
        <Link
          href="/admin/flyers"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Flyer Rotation</p>
          <p className="mt-1 text-sm text-slate-600">
            Pin flyers to Board 1 (Master), Board 2 (This Week), or Board 3 (Today) — with Active / Draft /
            Archived status.
          </p>
        </Link>
        <Link
          href="/admin/promo-codes"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">Promo Codes</p>
          <p className="mt-1 text-sm text-slate-600">
            Issue codes vendors can redeem for an instant free Top 10/Featured upgrade.
          </p>
        </Link>
        <Link
          href="/admin/photos"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">🖼️ Photo Admin</p>
          <p className="mt-1 text-sm text-slate-600">
            Every vendor logo, gallery photo, and flyer photo in one place — add, crop, or take one down.
          </p>
        </Link>
        <Link
          href="/admin/reports"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">🐞 Bug / Report Log</p>
          <p className="mt-1 text-sm text-slate-600">
            Every app bug report and vendor/event report, timestamped — new / reviewed / resolved.
          </p>
        </Link>
        <Link
          href="/admin/cleanup"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">🧹 Admin Cleanup</p>
          <p className="mt-1 text-sm text-slate-600">
            Test accounts, incomplete signups, and duplicate vendors — flag, merge, archive, or delete. Nothing
            happens automatically.
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
        <Link
          href="/admin/accounts"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">📇 Accounts Directory</p>
          <p className="mt-1 text-sm text-slate-600">
            Every vendor account — business ID, email, kind, and status — with Total/Active/New Today counts,
            organized by city.
          </p>
        </Link>
        <Link
          href="/admin/event-log"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">📋 LOV Event Log</p>
          <p className="mt-1 text-sm text-slate-600">
            Every event/flyer by city and month, same treatment as Bookkeeping — exportable as CSV or a printable PDF.
          </p>
        </Link>
        <Link
          href="/admin/placements"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">📊 Placements</p>
          <p className="mt-1 text-sm text-slate-600">
            Active/upcoming paid boosts and the 5 Top 10 Featured vendors, with grant/end-early controls — kept
            separate from Founder Vendor status.
          </p>
        </Link>
        <Link
          href="/admin/receipts"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">🧾 All Receipts</p>
          <p className="mt-1 text-sm text-slate-600">
            Every paid checkout across every account, itemized with the $1.00 platform fee — filter by month and
            city, drill into one receipt, export CSV or print.
          </p>
        </Link>
        <Link
          href="/admin/history"
          className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
        >
          <p className="font-bold text-slate-900">🗂️ Notes &amp; History</p>
          <p className="mt-1 text-sm text-slate-600">
            Private CRM notes, follow-up tracking, and a full chronological timeline for any vendor/account/host or
            event — private, never visible to vendors or the public.
          </p>
        </Link>
      </div>
    </div>
  );
}
