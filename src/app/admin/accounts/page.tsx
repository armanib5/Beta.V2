"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import type { Vendor } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  slug: string;
  email: string;
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
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const { data } = await supabase.from("vendors").select("*").order("onboarded_at", { ascending: false }).returns<Vendor[]>();
      if (cancelled) return;
      setVendors(data ?? []);
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
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Every vendor account — business ID (slug), email, kind, and status. PIN/password values are never shown here
        (they&rsquo;re hashed, not stored retrievably) — the Business ID is the only account identifier visible.
      </p>

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
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        <Link href={`/vendor?slug=${encodeURIComponent(r.slug)}`} className="underline hover:no-underline">
                          {r.name}
                        </Link>
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
                    </tr>
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
