"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vendor, VendorStatus, VendorStatusLog } from "@/lib/types";
import { logActivity } from "@/lib/activity";

function describePatch(patch: Partial<Vendor>): string {
  const parts: string[] = [];
  if (patch.status) parts.push(`status → ${patch.status}`);
  if ("is_founding_vendor" in patch) parts.push(`Founding Vendor ${patch.is_founding_vendor ? "on" : "off"}`);
  if ("is_top10" in patch) parts.push(`Top 10 ${patch.is_top10 ? "on" : "off"}`);
  return parts.join(", ");
}

const STATUS_STYLES: Record<VendorStatus, string> = {
  pending: "bg-amber-50 border-amber-300 text-amber-800",
  active: "bg-green-50 border-green-300 text-green-800",
  suspended: "bg-orange-50 border-orange-300 text-orange-800",
  rejected: "bg-red-50 border-red-300 text-red-800",
};

type FilterKey = "all" | VendorStatus | "top10" | "boost" | "featured" | "reapproved";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function boostCountdown(expiresAt: string): { label: string; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "Boost expired", expired: true };
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return { label: `${days} day${days === 1 ? "" : "s"} left`, expired: false };
}

export function VendorAdminList({ vendors: initialVendors, statusLog }: { vendors: Vendor[]; statusLog: VendorStatusLog[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const reapprovedIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of statusLog) {
      if (row.new_status !== "active") continue;
      counts.set(row.vendor_id, (counts.get(row.vendor_id) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  }, [statusLog]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      pending: 0,
      active: 0,
      rejected: 0,
      suspended: 0,
      top10: 0,
      boost: 0,
      featured: 0,
      reapproved: 0,
    };
    for (const v of vendors) {
      c[v.status] = (c[v.status] ?? 0) + 1;
      if (v.is_top10) c.top10++;
      if (v.boost_requested_at) c.boost++;
      if (v.is_featured) c.featured++;
      if (reapprovedIds.has(v.id)) c.reapproved++;
    }
    return c;
  }, [vendors, reapprovedIds]);

  const filtered = useMemo(() => {
    const list = vendors.filter((v) => {
      switch (filter) {
        case "all":
          return true;
        case "top10":
          return v.is_top10;
        case "boost":
          return !!v.boost_requested_at;
        case "featured":
          return v.is_featured;
        case "reapproved":
          return reapprovedIds.has(v.id);
        default:
          return v.status === filter;
      }
    });
    return [...list].sort((a, b) => {
      const aTime = a.approved_at ?? a.rejected_at ?? a.created_at;
      const bTime = b.approved_at ?? b.rejected_at ?? b.created_at;
      return bTime.localeCompare(aTime);
    });
  }, [vendors, filter, reapprovedIds]);

  async function updateVendor(id: string, patch: Partial<Vendor>) {
    setError(null);
    setBusyId(id);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("vendors")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single<Vendor>();
    setBusyId(null);

    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update vendor.");
      return;
    }
    logActivity(supabase, "vendor", data.id, data.business_name, "Updated", describePatch(patch));
    setVendors((prev) => prev.map((v) => (v.id === id ? data : v)));
    setConfirmation(`✓ Saved — ${data.business_name}: ${describePatch(patch)}`);
    window.setTimeout(() => setConfirmation((c) => (c?.startsWith("✓") ? null : c)), 4000);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function batchUpdate(patch: Partial<Vendor>) {
    setError(null);
    setBatchBusy(true);
    const supabase = createClient();
    const ids = [...selected];
    const results = await Promise.all(
      ids.map((id) => supabase.from("vendors").update(patch).eq("id", id).select("*").single<Vendor>()),
    );
    setBatchBusy(false);
    const updated = new Map<string, Vendor>();
    for (const r of results) {
      if (r.data) {
        updated.set(r.data.id, r.data);
        logActivity(supabase, "vendor", r.data.id, r.data.business_name, "Updated (batch)", describePatch(patch));
      }
    }
    setVendors((prev) => prev.map((v) => updated.get(v.id) ?? v));
    setSelected(new Set());
  }

  const boostRequests = vendors.filter((v) => v.boost_requested_at && !v.is_top10);

  async function approveBoost(vendor: Vendor) {
    await updateVendor(vendor.id, {
      is_top10: true,
      category_tier: "top_10",
      is_featured: true,
      boost_requested_at: null,
    });
  }

  async function saveExpiry(vendor: Vendor) {
    const raw = expiryDrafts[vendor.id];
    await updateVendor(vendor.id, { boost_expires_at: raw ? new Date(raw).toISOString() : null });
  }

  function downloadCsv() {
    const header = ["Business", "Status", "Tier", "Founding", "Top 10", "Featured", "Approved At", "Boost Expires", "Reapproved", "Created"];
    const lines = filtered.map((v) =>
      [
        v.business_name,
        v.status,
        v.category_tier,
        v.is_founding_vendor ? "Yes" : "",
        v.is_top10 ? "Yes" : "",
        v.is_featured ? "Yes" : "",
        v.approved_at ? new Date(v.approved_at).toLocaleString("en-US") : "",
        v.boost_expires_at ? new Date(v.boost_expires_at).toLocaleString("en-US") : "",
        reapprovedIds.has(v.id) ? "Yes" : "",
        new Date(v.created_at).toLocaleString("en-US"),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-vendor-approvals-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadWord() {
    const rows = filtered
      .map(
        (v) =>
          `<tr><td>${v.business_name}</td><td>${v.status}</td><td>${v.category_tier}</td><td>${v.is_top10 ? "Yes" : ""}</td><td>${v.is_featured ? "Yes" : ""}</td><td>${v.approved_at ? new Date(v.approved_at).toLocaleString("en-US") : ""}</td><td>${v.boost_expires_at ? new Date(v.boost_expires_at).toLocaleString("en-US") : ""}</td></tr>`,
      )
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Vendor Approvals</title></head>
<body>
<h1>CityPinned — Vendor Approvals (${filter})</h1>
<p>Generated ${new Date().toLocaleString("en-US")} — ${filtered.length} of ${vendors.length} total.</p>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<thead><tr><th>Business</th><th>Status</th><th>Tier</th><th>Top 10</th><th>Featured</th><th>Approved At</th><th>Boost Expires</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-vendor-approvals-${filter}-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (vendors.length === 0) {
    return <p className="mt-8 text-sm text-slate-500">No vendors yet.</p>;
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: `${counts.pending} Pending` },
    { key: "active", label: `${counts.active} Active` },
    { key: "rejected", label: `${counts.rejected} Rejected` },
    { key: "suspended", label: `${counts.suspended} Suspended` },
    { key: "reapproved", label: `${counts.reapproved} Reapproved` },
    { key: "top10", label: `${counts.top10} Top 10` },
    { key: "boost", label: `${counts.boost} Boost Requested` },
    { key: "featured", label: `${counts.featured} Featured` },
  ];

  return (
    <div className="mt-6 space-y-3">
      {confirmation && (
        <div className="sticky top-2 z-20 rounded-xl border-2 border-green-400 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 shadow-md">
          {confirmation}
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f.key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={downloadCsv}
          className="ml-auto rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⬇️ CSV
        </button>
        <button
          type="button"
          onClick={downloadWord}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          📄 Word
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          🖨️ Print
        </button>
      </div>
      <p className="text-xs font-medium text-slate-500 print:hidden">{filtered.length} shown, most recently approved first</p>

      {boostRequests.length > 0 && (
        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 print:hidden">
          <h2 className="font-bold text-indigo-900">💰 Boost Requests ({boostRequests.length})</h2>
          <p className="mt-1 text-xs text-indigo-800">Vendors who self-reported paying for a Boost/Featured upgrade.</p>
          <div className="mt-3 space-y-2">
            {boostRequests.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white p-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{v.business_name}</p>
                  <p className="text-xs text-slate-500">Requested {relativeTime(v.boost_requested_at!)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveBoost(v)}
                    className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    ✓ Approve Boost
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVendor(v.id, { boost_requested_at: null })}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-md print:hidden">
          <span className="text-sm font-semibold text-slate-700">{selected.size} selected</span>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => batchUpdate({ status: "active" })}
            className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve All
          </button>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => batchUpdate({ status: "rejected" })}
            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject All
          </button>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => setSelected(new Set())}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      )}
      {filtered.length === 0 && <p className="text-sm text-slate-500">Nothing matches this filter.</p>}
      {filtered.map((vendor) => {
        const busy = busyId === vendor.id;
        const countdown = vendor.is_top10 && vendor.boost_expires_at ? boostCountdown(vendor.boost_expires_at) : null;
        return (
          <div
            key={vendor.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${STATUS_STYLES[vendor.status]}`}
          >
            <input
              type="checkbox"
              checked={selected.has(vendor.id)}
              onChange={() => toggleSelected(vendor.id)}
              className="h-4 w-4 shrink-0 print:hidden"
              aria-label={`Select ${vendor.business_name}`}
            />
            {vendor.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary vendor-uploaded URLs
              <img src={vendor.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/60 text-lg font-bold">
                {vendor.business_name.charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-900">{vendor.business_name}</p>
              <p className="truncate text-xs text-slate-600">{vendor.contact_email}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {vendor.status}
                {vendor.is_founding_vendor && " · 🏆 Founding"}
                {vendor.is_top10 && " · ⭐ Top 10"}
                {reapprovedIds.has(vendor.id) && " · 🔁 Reapproved"}
              </p>
              {vendor.approved_at && (
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Approved {relativeTime(vendor.approved_at)} ({new Date(vendor.approved_at).toLocaleString("en-US")})
                </p>
              )}
              {vendor.rejected_at && vendor.status === "rejected" && (
                <p className="mt-0.5 text-[10px] text-slate-500">Rejected {relativeTime(vendor.rejected_at)}</p>
              )}
              {countdown && (
                <p className={`mt-0.5 text-[10px] font-bold ${countdown.expired ? "text-red-600" : "text-indigo-600"}`}>
                  ⏳ {countdown.label}
                </p>
              )}
              {vendor.is_top10 && (
                <div className="mt-1 flex items-center gap-1 print:hidden">
                  <input
                    type="date"
                    value={expiryDrafts[vendor.id] ?? (vendor.boost_expires_at ? vendor.boost_expires_at.slice(0, 10) : "")}
                    onChange={(e) => setExpiryDrafts((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px]"
                    title="Boost expiry date (blank = permanent)"
                  />
                  <button
                    type="button"
                    onClick={() => saveExpiry(vendor)}
                    disabled={busy}
                    className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 print:hidden">
              {vendor.status !== "active" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "active" })}
                  className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? "Saving…" : vendor.approved_at ? "Reapprove" : "Approve"}
                </button>
              )}
              {vendor.status !== "rejected" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "rejected" })}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Reject"}
                </button>
              )}
              {vendor.status === "active" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "suspended" })}
                  className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Suspend"}
                </button>
              )}
              {vendor.status !== "pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "pending" })}
                  className="rounded-full bg-slate-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Reset to Pending"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => updateVendor(vendor.id, { is_founding_vendor: !vendor.is_founding_vendor })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  vendor.is_founding_vendor
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "border border-amber-400 text-amber-700 hover:bg-amber-50"
                }`}
              >
                🏆 Founding
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  updateVendor(vendor.id, {
                    is_top10: !vendor.is_top10,
                    boost_expires_at: vendor.is_top10 ? null : vendor.boost_expires_at,
                  })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  vendor.is_top10
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "border border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                ⭐ Top 10
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
