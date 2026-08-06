"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import type { PricingTier, PromoCode, PromoCodeGrant, Vendor } from "@/lib/types";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function AdminPromoCodesPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [vendors, setVendors] = useState<Pick<Vendor, "id" | "business_name">[]>([]);
  const [grants, setGrants] = useState<PromoCodeGrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newCode, setNewCode] = useState(randomCode());
  const [newTierId, setNewTierId] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("1");
  const [newExpiresAt, setNewExpiresAt] = useState("");

  async function loadGrants() {
    const supabase = createClient();
    const { data } = await supabase.from("promo_code_grants").select("*").returns<PromoCodeGrant[]>();
    setGrants(data ?? []);
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
      const [{ data: codeRows }, { data: tierRows }, { data: vendorRows }, { data: grantRows }] = await Promise.all([
        supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).returns<PromoCode[]>(),
        supabase.from("pricing_tiers").select("*").eq("is_active", true).order("sort_order").returns<PricingTier[]>(),
        supabase
          .from("vendors")
          .select("id,business_name")
          .order("business_name")
          .returns<Pick<Vendor, "id" | "business_name">[]>(),
        supabase.from("promo_code_grants").select("*").returns<PromoCodeGrant[]>(),
      ]);
      if (cancelled) return;
      setCodes(codeRows ?? []);
      setTiers(tierRows ?? []);
      setVendors(vendorRows ?? []);
      setGrants(grantRows ?? []);
      setNewTierId(tierRows?.[0]?.id ?? "");
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.business_name])), [vendors]);

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newTierId) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("promo_codes")
      .insert({
        code: newCode.trim().toUpperCase(),
        tier_id: newTierId,
        max_uses: newMaxUses.trim() ? Number(newMaxUses.trim()) : null,
        expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
      })
      .select("*")
      .single<PromoCode>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create code.");
      return;
    }
    setCodes((prev) => [data, ...prev]);
    setNewCode(randomCode());
    setNewMaxUses("1");
    setNewExpiresAt("");
  }

  async function toggleActive(code: PromoCode) {
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("promo_codes")
      .update({ is_active: !code.is_active })
      .eq("id", code.id)
      .select("*")
      .single<PromoCode>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update code.");
      return;
    }
    setCodes((prev) => prev.map((c) => (c.id === code.id ? data : c)));
  }

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Promo Codes</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        A vendor enters a code in their dashboard for an instant free upgrade — no payment, no waiting on
        approval.
      </p>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <form onSubmit={createCode} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Code</label>
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Grants tier</label>
          <select
            value={newTierId}
            onChange={(e) => setNewTierId(e.target.value)}
            className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Max uses (blank = unlimited)</label>
          <input
            type="number"
            min={1}
            value={newMaxUses}
            onChange={(e) => setNewMaxUses(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Expires (optional)</label>
          <input
            type="date"
            value={newExpiresAt}
            onChange={(e) => setNewExpiresAt(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Create Code
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {codes.length === 0 && <p className="text-sm text-slate-500">No promo codes yet.</p>}
        {codes.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-slate-900">{c.code}</p>
                <p className="text-xs text-slate-500">
                  {tierById.get(c.tier_id)?.name ?? "Unknown tier"} · redeemed {c.uses_count}
                  {c.max_uses ? ` / ${c.max_uses}` : ""}
                  {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString("en-US")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(c)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  c.is_active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                }`}
              >
                {c.is_active ? "Active" : "Disabled"}
              </button>
            </div>
            <CodeGrants
              code={c}
              vendors={vendors}
              vendorNameById={vendorNameById}
              grants={grants.filter((g) => g.promo_code_id === c.id)}
              onChanged={loadGrants}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Only a vendor with a grant row for this specific code can redeem it -
 * this is that allowlist, editable per code. Without at least one grant,
 * the code is active but nobody can actually use it (redeem_promo_code
 * checks this table, migration 0051). */
function CodeGrants({
  code,
  vendors,
  vendorNameById,
  grants,
  onChanged,
}: {
  code: PromoCode;
  vendors: Pick<Vendor, "id" | "business_name">[];
  vendorNameById: Map<string, string>;
  grants: PromoCodeGrant[];
  onChanged: () => void;
}) {
  const grantedVendorIds = useMemo(() => new Set(grants.map((g) => g.vendor_id)), [grants]);
  const availableVendors = useMemo(() => vendors.filter((v) => !grantedVendorIds.has(v.id)), [vendors, grantedVendorIds]);
  const [pickerVendorId, setPickerVendorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function grantVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!pickerVendorId) return;
    setSaving(true);
    setLocalError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("promo_code_grants")
      .insert({ promo_code_id: code.id, vendor_id: pickerVendorId });
    setSaving(false);
    if (insertError) {
      setLocalError(insertError.message);
      return;
    }
    setPickerVendorId("");
    onChanged();
  }

  async function revokeVendor(vendorId: string) {
    setLocalError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("promo_code_grants")
      .delete()
      .eq("promo_code_id", code.id)
      .eq("vendor_id", vendorId);
    if (deleteError) {
      setLocalError(deleteError.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authorized vendors</p>
      {grants.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">
          No vendors authorized yet — nobody can redeem this code until you add at least one below.
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {grants.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-700"
            >
              {vendorNameById.get(g.vendor_id) ?? g.vendor_id}
              <button
                type="button"
                onClick={() => revokeVendor(g.vendor_id)}
                title="Revoke"
                className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700 hover:bg-red-200 hover:text-red-800"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={grantVendor} className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={pickerVendorId}
          onChange={(e) => setPickerVendorId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="">+ Add a vendor…</option>
          {availableVendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.business_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!pickerVendorId || saving}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {saving ? "Adding…" : "Authorize"}
        </button>
        {localError && <p role="alert" className="text-xs font-medium text-red-600">{localError}</p>}
      </form>
    </div>
  );
}
