"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { Vendor, VendorStatus } from "@/lib/types";
import { VendorAdminList } from "@/components/vendor-admin-list";

export default function AdminVendorsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<Vendor[]>();
      if (cancelled) return;
      setVendors(data ?? []);
      setStatus("ready");
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
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with an account listed in the <code>admins</code> table to approve or reject vendors.
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

  const counts = vendors.reduce<Record<VendorStatus, number>>(
    (acc, v) => ({ ...acc, [v.status]: acc[v.status] + 1 }),
    { pending: 0, active: 0, suspended: 0, rejected: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Vendor Approvals</h1>
        <Link href="/admin/board" className="text-sm font-semibold text-slate-700 underline">
          Venue Board →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Approve a vendor once their payment is confirmed in Stripe, or award Founding Vendor / Top 10 as a
        boost. Private — every write is re-checked by the database, not just this page.
      </p>
      <p className="mt-3 text-xs font-medium text-slate-500">
        {counts.pending} pending · {counts.active} active · {counts.rejected} rejected · {counts.suspended} suspended
      </p>
      <VendorAdminList vendors={vendors} />
    </div>
  );
}
