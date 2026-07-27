"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vendor, VendorStatus } from "@/lib/types";
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
  suspended: "bg-red-50 border-red-300 text-red-800",
};

export function VendorAdminList({ vendors: initialVendors }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

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

  if (vendors.length === 0) {
    return <p className="mt-8 text-sm text-slate-500">No vendors yet.</p>;
  }

  return (
    <div className="mt-6 space-y-3">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-md">
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
            onClick={() => batchUpdate({ status: "suspended" })}
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
      {vendors.map((vendor) => {
        const busy = busyId === vendor.id;
        return (
          <div
            key={vendor.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${STATUS_STYLES[vendor.status]}`}
          >
            <input
              type="checkbox"
              checked={selected.has(vendor.id)}
              onChange={() => toggleSelected(vendor.id)}
              className="h-4 w-4 shrink-0"
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
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {vendor.status !== "active" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "active" })}
                  className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {vendor.status !== "suspended" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "suspended" })}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              {vendor.status !== "pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateVendor(vendor.id, { status: "pending" })}
                  className="rounded-full bg-slate-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  Reset to Pending
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
                onClick={() => updateVendor(vendor.id, { is_top10: !vendor.is_top10 })}
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
