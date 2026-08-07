"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { Vendor } from "@/lib/types";
import { AdminCleanup, type CleanupVendorRow } from "@/components/admin-cleanup";

type RawRow = Vendor & { vendor_categories: { category_id: string }[] | null };

export default function AdminCleanupPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<CleanupVendorRow[]>([]);

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
        .select("*,vendor_categories(category_id)")
        .order("created_at", { ascending: false })
        .returns<RawRow[]>();
      if (cancelled) return;
      setVendors(
        (data ?? []).map((v) => ({ ...v, category_count: (v.vendor_categories ?? []).length })),
      );
      setStatus("ready");
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
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">🧹 Admin Cleanup</h1>
      <p className="mt-1 text-sm text-slate-600">
        Test accounts and incomplete signups never reach the public site (Board, Map, Directory) once flagged or
        while they have no category picked — this is where you review, merge, archive, or permanently remove them.
        Nothing here deletes anything automatically.
      </p>
      <div className="mt-6">
        <AdminCleanup initialVendors={vendors} />
      </div>
    </div>
  );
}
