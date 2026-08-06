"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import type { Category, LovEntry, Vendor } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  city: string;
  hasPin: boolean;
  entityType: string;
  hubType: string;
  status: Vendor["status"];
  onboardedAt: string | null;
  isToday: boolean;
}

function cityOf(v: Vendor): string {
  if (v.lat === null || v.lng === null) return "Unknown";
  return nearestCityCenter(v.lat, v.lng).city;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_STYLES: Record<Vendor["status"], string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  suspended: "bg-slate-200 text-slate-700",
  rejected: "bg-red-100 text-red-800",
};

const HUB_LABELS: Record<Vendor["hub_type"], string> = {
  vendor: "🛒 Vendor",
  menu: "🍽️ Menu",
  hosting: "🏠 Hosting",
  show: "🎭 Show",
};

function toCsv(rows: Row[]): string {
  const header = ["Business Name", "Business ID (slug)", "Email", "City", "Has Pin", "Entity Type", "Kind", "Status", "Onboarded"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.slug,
      r.email,
      r.city,
      r.hasPin ? "Yes" : "No",
      r.entityType,
      r.hubType,
      r.status,
      r.onboardedAt ? new Date(r.onboardedAt).toLocaleString("en-US") : "—",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function AccountsDirectoryPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [flyersByVendor, setFlyersByVendor] = useState<Map<string, LovEntry[]>>(new Map());
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function refreshVendors() {
    const supabase = createClient();
    const { data } = await supabase.from("vendors").select("*").order("onboarded_at", { ascending: false }).returns<Vendor[]>();
    setVendors(data ?? []);
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
      const [{ data }, { data: flyerRows }] = await Promise.all([
        supabase.from("vendors").select("*").order("onboarded_at", { ascending: false }).returns<Vendor[]>(),
        supabase.from("lov_entries").select("*").not("vendor_id", "is", null).returns<LovEntry[]>(),
      ]);
      if (cancelled) return;
      setVendors(data ?? []);
      const byVendor = new Map<string, LovEntry[]>();
      (flyerRows ?? []).forEach((f) => {
        if (!f.vendor_id) return;
        const list = byVendor.get(f.vendor_id) ?? [];
        list.push(f);
        byVendor.set(f.vendor_id, list);
      });
      setFlyersByVendor(byVendor);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const today = todayKey();
    return vendors.map((v) => {
      const onboardedAt = v.onboarded_at ?? v.created_at;
      return {
        id: v.id,
        name: v.business_name,
        slug: v.slug,
        email: v.contact_email,
        phone: v.phone,
        city: cityOf(v),
        hasPin: v.lat !== null && v.lng !== null,
        entityType: v.entity_type,
        hubType: v.hub_type,
        status: v.status,
        onboardedAt,
        isToday: onboardedAt ? onboardedAt.slice(0, 10) === today : false,
      };
    });
  }, [vendors]);

  const cities = useMemo(() => ["All", "Unknown", ...CITY_CENTERS.map((c) => c.city).filter((v, i, a) => a.indexOf(v) === i)], []);

  const filteredRows = rows
    .filter((r) => cityFilter === "All" || r.city === cityFilter)
    .filter((r) => statusFilter === "All" || r.status === statusFilter)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });

  const groupedByCity = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filteredRows) {
      const list = map.get(r.city) ?? [];
      list.push(r);
      map.set(r.city, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows]);

  const totalCount = filteredRows.length;
  const activeCount = filteredRows.filter((r) => r.status === "active").length;
  const todayCount = filteredRows.filter((r) => r.isToday).length;

  function downloadCsv() {
    const csv = toCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-accounts-${cityFilter.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">🔒 Admin access required</h1>
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
    <div className="mx-auto max-w-5xl px-4 py-10 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Accounts Directory</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateForm((s) => !s)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {showCreateForm ? "✕ Close" : "+ Create Business"}
          </button>
          <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
            ← Admin Home
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Every vendor account — business ID (slug), email, kind, and status. PIN/password values are never shown here
        (they&rsquo;re hashed, not stored retrievably) — the Business ID is the only account identifier visible.
      </p>

      {showCreateForm && (
        <CreateBusinessForm
          onCreated={() => {
            refreshVendors();
          }}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ID, or email…"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm"
        />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {["All", "active", "pending", "suspended", "rejected"].map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Statuses" : s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ⬇️ Export CSV
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
          <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-800">{activeCount}</p>
          <p className="text-xs font-semibold uppercase text-green-700">Active</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-800">{todayCount}</p>
          <p className="text-xs font-semibold uppercase text-amber-700">New Today</p>
        </div>
      </div>

      {groupedByCity.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No accounts match.</p>
      ) : (
        groupedByCity.map(([city, cityRows]) => (
          <div key={city} className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900">
              {city} <span className="text-sm font-normal text-slate-500">({cityRows.length})</span>
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase text-slate-500">
                    <th className="py-2 pr-3">Business</th>
                    <th className="py-2 pr-3">Business ID</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Pin</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Onboarded</th>
                    <th className="py-2 pr-3 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="underline hover:no-underline"
                        >
                          {r.name}
                        </button>
                        {r.isToday && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">NEW</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{r.slug}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.email}</td>
                      <td className="py-2 pr-3">{r.hasPin ? "📍" : "—"}</td>
                      <td className="py-2 pr-3">
                        {r.entityType} · {HUB_LABELS[r.hubType as Vendor["hub_type"]] ?? r.hubType}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{r.onboardedAt ? new Date(r.onboardedAt).toLocaleDateString("en-US") : "—"}</td>
                      <td className="py-2 pr-3 print:hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="text-xs font-semibold text-slate-500 underline"
                        >
                          {expandedId === r.id ? "▲ Close" : "▸ View"}
                        </button>
                      </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr className="border-b border-slate-100 bg-slate-50 print:hidden">
                          <td colSpan={8} className="px-3 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="text-xs text-slate-600">
                                <p>
                                  <span className="font-semibold text-slate-800">Phone:</span> {r.phone ?? "—"}
                                </p>
                                <p className="mt-1">
                                  <span className="font-semibold text-slate-800">Email:</span> {r.email}
                                </p>
                                <p className="mt-1">
                                  <span className="font-semibold text-slate-800">Kind:</span> {r.entityType} ·{" "}
                                  {HUB_LABELS[r.hubType as Vendor["hub_type"]] ?? r.hubType}
                                </p>
                                <p className="mt-1">
                                  <span className="font-semibold text-slate-800">City:</span> {r.city}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(r.hubType === "menu" || r.hubType === "vendor") && (
                                  <Link
                                    href={`/vendor?slug=${encodeURIComponent(r.slug)}`}
                                    target="_blank"
                                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    {r.hubType === "menu" ? "🍽️ Menu Hub" : "🛒 Vendor Hub"}
                                  </Link>
                                )}
                                {r.hasPin && (
                                  <Link
                                    href={`/map?q=${encodeURIComponent(r.name)}`}
                                    target="_blank"
                                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    📍 Our Pin on Map
                                  </Link>
                                )}
                                {(flyersByVendor.get(r.id) ?? []).map((f) => (
                                  <Link
                                    key={f.id}
                                    href={`/admin/flyers`}
                                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    🗒️ Flyer: {f.name}
                                  </Link>
                                ))}
                                <Link
                                  href={`/admin/history?type=vendor&id=${r.id}`}
                                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  🗂️ Notes &amp; History
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Creates a Business ID + PIN from scratch via the new admin-only Worker
 * route - the piece that never existed anywhere in this codebase before
 * (the 20 existing Host Hub vendor rows only work because someone
 * created their auth users by hand, out of band). Once created, the
 * owner can log in immediately with Business ID + PIN
 * (vendor-login-form.tsx) and later set their own real email/password
 * from the dashboard (AccountLoginSettings, already built) - no new code
 * needed for either of those, this is the one missing piece. */
function CreateBusinessForm({ onCreated }: { onCreated: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pin, setPin] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ business_id: string; pin: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .returns<Category[]>()
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired — please log in again.");
        return;
      }
      const location = CITY_CENTERS.find((c) => c.id === locationId);
      const res = await fetch("/api/admin-create-business", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          business_name: businessName.trim(),
          pin: pin.trim() || undefined,
          category_id: categoryId || undefined,
          lat: location?.lat,
          lng: location?.lng,
        }),
      });
      const data: { business_id?: string; pin?: string; error?: string } = await res.json();
      if (!res.ok || !data.business_id || !data.pin) {
        setError(data.error ?? "Could not create the business.");
        return;
      }
      setResult({ business_id: data.business_id, pin: data.pin });
      setBusinessName("");
      setCategoryId("");
      setLocationId("");
      setPin("");
      onCreated();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="mt-4 rounded-xl border border-green-300 bg-green-50 p-4 print:hidden">
        <p className="text-sm font-bold text-green-900">✅ Business created — hand these to the owner now</p>
        <p className="mt-2 text-sm text-green-800">
          These won&rsquo;t be shown again (the PIN isn&rsquo;t stored anywhere retrievable, same as any password).
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-green-300 bg-white p-3">
            <p className="text-xs font-semibold uppercase text-green-700">Business ID</p>
            <p className="font-mono text-base font-bold text-slate-900">{result.business_id}</p>
          </div>
          <div className="rounded-lg border border-green-300 bg-white p-3">
            <p className="text-xs font-semibold uppercase text-green-700">PIN</p>
            <p className="font-mono text-base font-bold text-slate-900">{result.pin}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-3 rounded-full border border-green-400 px-4 py-2 text-xs font-semibold text-green-800 hover:bg-green-100"
        >
          + Create Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
      <p className="text-sm font-bold text-slate-900">Create a business listing + Business ID/PIN</p>
      <p className="mt-1 text-xs text-slate-500">
        Gives the owner a Business ID + PIN to log in with — they can set up their own free email/password from the
        dashboard whenever they&rsquo;re ready.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          placeholder="Business name (e.g. San Jose Candy Shop)"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Category (optional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Location / area (optional)</option>
          {CITY_CENTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          placeholder="PIN (leave blank to auto-generate)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-3 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create Business"}
      </button>
    </form>
  );
}
