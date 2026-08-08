"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";

type ReportStatus = "new" | "reviewed" | "resolved";

interface Report {
  id: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

const STATUS_STYLE: Record<ReportStatus, string> = {
  new: "bg-red-100 text-red-800",
  reviewed: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
};

export default function AdminReportsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [reports, setReports] = useState<Report[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | "app_bug" | "vendor" | "event">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

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
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<Report[]>();
      if (cancelled) return;
      setReports(data ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setReportStatus(id: string, next: ReportStatus) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("reports").update({ status: next }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    flash(`✓ Marked ${next}`);
  }

  // A report on a vendor/event auto-suspends it the moment it's submitted
  // (migration 0049) - marking the report resolved doesn't undo that on
  // its own, so this is the loop-closer once an admin has actually
  // reviewed it and decided the report doesn't hold up.
  async function reactivateListing(r: Report) {
    if (!r.target_id) return;
    setError(null);
    const supabase = createClient();
    const name = r.target_name ?? r.target_type;
    const table = r.target_type === "vendor" ? "vendors" : "lov_entries";
    const { error: updateError } = await supabase.from(table).update({ status: "active" }).eq("id", r.target_id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    logActivity(supabase, r.target_type === "vendor" ? "vendor" : "event", r.target_id, name, "Admin reactivated listing after report review");
    flash(`✓ Reactivated ${name}`);
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">🔒 Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  const filtered = reports.filter(
    (r) => (typeFilter === "all" || r.target_type === typeFilter) && (statusFilter === "all" || r.status === statusFilter),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">🐞 Bug / Report Log</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Every submission from the Report form on a flyer/vendor/pin, or the waffle menu&apos;s &quot;Report a
        Bug,&quot; timestamped as it comes in. A vendor or event report immediately suspends/hides that listing
        from the public site — use &quot;Reactivate Listing&quot; below if a report doesn&apos;t hold up.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "app_bug", "vendor", "event"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              typeFilter === t ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t === "all" ? "All Types" : t === "app_bug" ? "🐞 App Bugs" : t === "vendor" ? "Vendor Reports" : "Event Reports"}
          </button>
        ))}
        {(["all", "new", "reviewed", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === s ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "all" ? "All Statuses" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-sm font-medium text-slate-500">{filtered.length} shown</span>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {toast && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{toast}</p>}

      <div className="mt-6 space-y-2">
        {filtered.length === 0 && <p className="text-sm text-slate-500">Nothing matches this filter.</p>}
        {filtered.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {r.target_type === "app_bug" ? "🐞" : "🚩"} {r.target_name ?? r.target_type}
                </p>
                <p className="text-xs font-semibold text-slate-600">{r.reason}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[r.status]}`}>
                {r.status}
              </span>
            </div>
            {r.details && <p className="mt-2 text-sm text-slate-700">{r.details}</p>}
            <p className="mt-2 text-[11px] text-slate-400">
              {new Date(r.created_at).toLocaleString("en-US")} · {r.target_type}
              {r.target_id ? ` · ${r.target_id}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              {r.status !== "reviewed" && (
                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "reviewed")}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                >
                  Mark Reviewed
                </button>
              )}
              {r.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "resolved")}
                  className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 hover:bg-green-200"
                >
                  Mark Resolved
                </button>
              )}
              {r.status !== "new" && (
                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "new")}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Reopen
                </button>
              )}
              {(r.target_type === "vendor" || r.target_type === "event") && (
                <button
                  type="button"
                  onClick={() => reactivateListing(r)}
                  className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
                  title="Undo the automatic suspend this report triggered"
                >
                  ↩️ Reactivate Listing
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
