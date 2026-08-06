"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import type { PricingTier, Vendor } from "@/lib/types";
import { formatPrice } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  city: string;
  status: string;
  tierName: string;
  priceCents: number;
  founding: boolean;
  top10: boolean;
  date: string; // ISO
  month: string; // "2026-07"
}

function cityOf(v: Vendor): string {
  if (v.lat === null || v.lng === null) return "Unknown";
  return nearestCityCenter(v.lat, v.lng).city;
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function toCsv(rows: Row[]): string {
  const header = ["Business Name", "City", "Status", "Tier", "Price", "Founding", "Top 10", "Date"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.city,
      r.status,
      r.tierName,
      r.priceCents ? formatPrice(r.priceCents) : "",
      r.founding ? "Yes" : "No",
      r.top10 ? "Yes" : "No",
      new Date(r.date).toLocaleString("en-US"),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function BookkeepingPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [payingOnly, setPayingOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: vendorRows }, { data: tierRows }] = await Promise.all([
        supabase.from("vendors").select("*").order("onboarded_at", { ascending: false }).returns<Vendor[]>(),
        supabase.from("pricing_tiers").select("*").returns<PricingTier[]>(),
      ]);
      if (cancelled) return;
      setVendors(vendorRows ?? []);
      setTiers(tierRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const rows = useMemo<Row[]>(
    () =>
      vendors.map((v) => {
        const tier = v.tier_id ? tierById.get(v.tier_id) : null;
        const date = v.onboarded_at ?? v.created_at;
        return {
          id: v.id,
          name: v.business_name,
          city: cityOf(v),
          status: v.status,
          tierName: tier?.name ?? "—",
          priceCents: tier?.price_cents ?? 0,
          founding: v.is_founding_vendor,
          top10: v.is_top10,
          date,
          month: monthOf(date),
        };
      }),
    [vendors, tierById],
  );

  const cities = useMemo(() => ["All", "Unknown", ...CITY_CENTERS.map((c) => c.city).filter((v, i, a) => a.indexOf(v) === i)], []);
  const filteredRows = rows
    .filter((r) => cityFilter === "All" || r.city === cityFilter)
    .filter((r) => !payingOnly || r.priceCents > 0);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filteredRows) {
      const list = map.get(r.month) ?? [];
      list.push(r);
      map.set(r.month, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredRows]);

  const totalRevenue = filteredRows.reduce((sum, r) => sum + r.priceCents, 0);

  function downloadCsv() {
    const csv = toCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-bookkeeping-${cityFilter.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <div className="mx-auto max-w-4xl px-4 py-10 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Bookkeeping</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Every vendor account — pending, active, or suspended — with its tier, price, and timestamp.
        Grouped by month so this doubles as a paper trail for taxes/legal.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
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
        <button
          type="button"
          onClick={() => setPayingOnly((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            payingOnly ? "bg-green-600 text-white" : "border border-green-400 text-green-700 hover:bg-green-50"
          }`}
        >
          💰 Paying Accounts Only ($50/$100)
        </button>
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

      <p className="mt-4 text-sm font-semibold text-slate-700">
        {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} · {formatPrice(totalRevenue)} total tier value
      </p>

      {groupedByMonth.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No records yet.</p>
      ) : (
        groupedByMonth.map(([month, monthRows]) => (
          <div key={month} className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900">
              {new Date(month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase text-slate-500">
                    <th className="py-2 pr-3">Business</th>
                    <th className="py-2 pr-3">City</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Badges</th>
                    <th className="py-2 pr-3">Date/Time</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">{r.name}</td>
                      <td className="py-2 pr-3">{r.city}</td>
                      <td className="py-2 pr-3 capitalize">{r.status}</td>
                      <td className="py-2 pr-3">{r.tierName}</td>
                      <td className="py-2 pr-3">{r.priceCents ? formatPrice(r.priceCents) : "—"}</td>
                      <td className="py-2 pr-3">
                        {r.founding && "🏆 "}
                        {r.top10 && "⭐"}
                        {!r.founding && !r.top10 && "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{new Date(r.date).toLocaleString("en-US")}</td>
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
