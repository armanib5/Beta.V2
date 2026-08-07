"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vendor } from "@/lib/types";
import { logActivity } from "@/lib/activity";

export type CleanupVendorRow = Vendor & { category_count: number };

type MergeSummary = {
  categories: number;
  photos: number;
  menu_items: number;
  listings: number;
  hosted_listings: number;
  booths: number;
  registrations: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function AdminCleanup({ initialVendors }: { initialVendors: CleanupVendorRow[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [keepId, setKeepId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [mergeConfirming, setMergeConfirming] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeSummary | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const testAccounts = useMemo(() => vendors.filter((v) => v.is_test_account), [vendors]);
  const incomplete = useMemo(
    () => vendors.filter((v) => !v.is_test_account && v.category_count === 0),
    [vendors],
  );
  const sortedForMerge = useMemo(
    () => [...vendors].sort((a, b) => a.business_name.localeCompare(b.business_name)),
    [vendors],
  );

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

  async function toggleTestAccount(vendor: CleanupVendorRow, next: boolean) {
    setBusyId(vendor.id);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("vendors").update({ is_test_account: next }).eq("id", vendor.id);
    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    logActivity(supabase, "vendor", vendor.id, vendor.business_name, next ? "Marked as Test Account" : "Unmarked as Test Account");
    setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, is_test_account: next } : v)));
    flash(next ? `✓ Flagged as test account — ${vendor.business_name}` : `✓ Unflagged — ${vendor.business_name}`);
  }

  async function deletePermanently(vendor: CleanupVendorRow) {
    setBusyId(vendor.id);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in.");
      setBusyId(null);
      setPendingDeleteId(null);
      return;
    }
    try {
      const res = await fetch("/api/admin-delete-vendor", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ vendor_id: vendor.id }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete this vendor.");
        return;
      }
      logActivity(supabase, "vendor", vendor.id, vendor.business_name, "Deleted", "Permanently removed via Admin Cleanup");
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      flash(`✓ Permanently deleted ${vendor.business_name}`);
    } catch {
      setError("Could not reach the server to delete this vendor.");
    } finally {
      setBusyId(null);
      setPendingDeleteId(null);
    }
  }

  async function runMerge() {
    if (!keepId || !removeId || keepId === removeId) return;
    setMergeBusy(true);
    setMergeError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("merge_vendor_data", {
      keep_id: keepId,
      remove_id: removeId,
    });
    setMergeBusy(false);
    if (rpcError) {
      setMergeError(rpcError.message);
      return;
    }
    const keepVendor = vendors.find((v) => v.id === keepId);
    const removeVendor = vendors.find((v) => v.id === removeId);
    logActivity(
      supabase,
      "vendor",
      keepId,
      keepVendor?.business_name ?? keepId,
      "Merged duplicate into this account",
      `From ${removeVendor?.business_name ?? removeId}`,
    );
    setMergeResult(data as MergeSummary);
    setMergeConfirming(false);
    // Refresh category_count for the kept vendor and clear the merged-from vendor's data locally
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id === keepId) {
          const summary = data as MergeSummary;
          return { ...v, category_count: v.category_count + summary.categories };
        }
        return v;
      }),
    );
  }

  function renderVendorCard(vendor: CleanupVendorRow, actions: React.ReactNode) {
    return (
      <div key={vendor.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-900">{vendor.business_name || "(no name)"}</p>
            <p className="text-xs text-slate-500">{vendor.contact_email}</p>
            <p className="mt-1 text-xs text-slate-500">
              Status: <span className="font-semibold">{vendor.status}</span> · Categories:{" "}
              <span className="font-semibold">{vendor.category_count}</span> · Created {fmtDate(vendor.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingDeleteId === vendor.id ? (
              <>
                <span className="self-center text-xs font-semibold text-red-700">Permanently delete?</span>
                <button
                  type="button"
                  onClick={() => deletePermanently(vendor)}
                  disabled={busyId === vendor.id}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busyId === vendor.id ? "Deleting…" : "Yes, permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {actions}
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(vendor.id)}
                  disabled={busyId === vendor.id}
                  className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑 Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {toast && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{toast}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

      <section>
        <h2 className="text-lg font-bold text-slate-900">🏷 Test Accounts ({testAccounts.length})</h2>
        <p className="mt-1 text-sm text-slate-600">
          Flagged as test — hidden from the public Board, Map, and Directory regardless of status or category.
        </p>
        <div className="mt-3 space-y-2">
          {testAccounts.length === 0 && <p className="text-sm text-slate-500">None flagged.</p>}
          {testAccounts.map((v) =>
            renderVendorCard(
              v,
              <button
                type="button"
                onClick={() => toggleTestAccount(v, false)}
                disabled={busyId === v.id}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Unflag
              </button>,
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900">📋 Incomplete / Placeholder Businesses ({incomplete.length})</h2>
        <p className="mt-1 text-sm text-slate-600">
          Never picked a category — these already stay off the public site automatically until they do, listed here
          so you can flag them as test data or remove them.
        </p>
        <div className="mt-3 space-y-2">
          {incomplete.length === 0 && <p className="text-sm text-slate-500">None found.</p>}
          {incomplete.map((v) =>
            renderVendorCard(
              v,
              <button
                type="button"
                onClick={() => toggleTestAccount(v, true)}
                disabled={busyId === v.id}
                className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Mark as Test Account
              </button>,
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900">🔀 Merge Duplicates</h2>
        <p className="mt-1 text-sm text-slate-600">
          Reassigns categories, photos, menu items, listings, booths, and registrations from one account to the
          other. The account you remove is left in place afterward — merge it, review it, then Archive or Delete it
          yourself below. Nothing is deleted as part of a merge.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-semibold text-slate-700">Keep this account</span>
            <select
              value={keepId}
              onChange={(e) => {
                setKeepId(e.target.value);
                setMergeResult(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a vendor…</option>
              {sortedForMerge.map((v) => (
                <option key={v.id} value={v.id} disabled={v.id === removeId}>
                  {v.business_name} ({v.status})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-semibold text-slate-700">Merge from (duplicate)</span>
            <select
              value={removeId}
              onChange={(e) => {
                setRemoveId(e.target.value);
                setMergeResult(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a vendor…</option>
              {sortedForMerge.map((v) => (
                <option key={v.id} value={v.id} disabled={v.id === keepId}>
                  {v.business_name} ({v.status})
                </option>
              ))}
            </select>
          </label>
        </div>
        {mergeError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{mergeError}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!mergeConfirming ? (
            <button
              type="button"
              onClick={() => setMergeConfirming(true)}
              disabled={!keepId || !removeId || keepId === removeId}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Preview Merge
            </button>
          ) : (
            <>
              <span className="text-xs font-semibold text-amber-700">
                Move everything from &quot;{vendors.find((v) => v.id === removeId)?.business_name}&quot; into &quot;
                {vendors.find((v) => v.id === keepId)?.business_name}&quot;?
              </span>
              <button
                type="button"
                onClick={runMerge}
                disabled={mergeBusy}
                className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {mergeBusy ? "Merging…" : "Yes, merge"}
              </button>
              <button
                type="button"
                onClick={() => setMergeConfirming(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
        {mergeResult && (
          <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            <p className="font-semibold">✓ Merged. Reassigned:</p>
            <p className="mt-1">
              {mergeResult.categories} categor{mergeResult.categories === 1 ? "y" : "ies"}, {mergeResult.photos}{" "}
              photo{mergeResult.photos === 1 ? "" : "s"}, {mergeResult.menu_items} menu item
              {mergeResult.menu_items === 1 ? "" : "s"}, {mergeResult.listings} listing
              {mergeResult.listings === 1 ? "" : "s"}, {mergeResult.hosted_listings} hosted listing
              {mergeResult.hosted_listings === 1 ? "" : "s"}, {mergeResult.booths} booth
              {mergeResult.booths === 1 ? "" : "s"}, {mergeResult.registrations} registration
              {mergeResult.registrations === 1 ? "" : "s"}.
            </p>
            <p className="mt-1">
              The duplicate account is now empty of that data — scroll up to Test Accounts / Incomplete Businesses to
              Archive or Delete it.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
