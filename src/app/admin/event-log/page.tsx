"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import type { Category, LovEntry, Vendor } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  city: string;
  status: LovEntry["status"];
  category: string;
  location: string;
  hostName: string | null;
  recurring: boolean;
  date: string; // ISO, used for sorting/grouping
  month: string; // "2026-08"
  isToday: boolean;
}

function cityFromRow(lat: number | null, lng: number | null, sectionZone: string | null): string {
  if (sectionZone) {
    const bySection = CITY_CENTERS.find((c) => c.section === sectionZone);
    if (bySection) return bySection.city;
  }
  if (lat !== null && lng !== null) return nearestCityCenter(lat, lng).city;
  return "Unknown";
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

const STATUS_STYLES: Record<LovEntry["status"], string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-slate-200 text-slate-700",
  archived: "bg-red-100 text-red-800",
};

function toCsv(rows: Row[]): string {
  const header = ["Event", "City", "Status", "Category", "Location", "Host", "Recurring", "Date"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.city,
      r.status,
      r.category,
      r.location,
      r.hostName ?? "—",
      r.recurring ? "Yes" : "No",
      new Date(r.date).toLocaleString("en-US"),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function EventLogPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [entries, setEntries] = useState<LovEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [todayOnly, setTodayOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: entryRows }, { data: categoryRows }, { data: vendorRows }] = await Promise.all([
        supabase.from("lov_entries").select("*").eq("type", "event").order("event_date", { ascending: false }).returns<LovEntry[]>(),
        supabase.from("categories").select("*").returns<Category[]>(),
        supabase.from("vendors").select("*").returns<Vendor[]>(),
      ]);
      if (cancelled) return;
      setEntries(entryRows ?? []);
      setCategories(categoryRows ?? []);
      setVendors(vendorRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const rows = useMemo<Row[]>(() => {
    const today = todayKey();
    return entries.map((e) => {
      const category = e.category_id ? categoryById.get(e.category_id) : null;
      const host = e.hosting_vendor_id ? vendorById.get(e.hosting_vendor_id) : null;
      const date = e.event_date ?? e.created_at;
      const start = e.event_date?.slice(0, 10) ?? null;
      const end = e.end_date?.slice(0, 10) ?? start;
      const isToday = !start ? Boolean(e.recurrence) : start <= today && (!end || end >= today);
      return {
        id: e.id,
        name: e.name,
        city: cityFromRow(e.lat, e.lng, e.section_zone),
        status: e.status,
        category: category?.name ?? "—",
        location: e.location ?? "",
        hostName: host?.business_name ?? null,
        recurring: Boolean(e.recurrence),
        date,
        month: monthOf(date),
        isToday,
      };
    });
  }, [entries, categoryById, vendorById]);

  const cities = useMemo(() => ["All", "Unknown", ...CITY_CENTERS.map((c) => c.city).filter((v, i, a) => a.indexOf(v) === i)], []);

  const filteredRows = rows
    .filter((r) => cityFilter === "All" || r.city === cityFilter)
    .filter((r) => !todayOnly || r.isToday);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filteredRows) {
      const list = map.get(r.month) ?? [];
      list.push(r);
      map.set(r.month, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
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
    a.download = `citypinned-event-log-${cityFilter.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <h1 className="text-2xl font-bold text-slate-900">LOV Event Log</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Every event/flyer — active, pending, draft, or archived — with its category, location, and host. Grouped by
        month, same treatment as Bookkeeping but for events instead of vendor accounts.
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
          onClick={() => setTodayOnly((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            todayOnly ? "bg-amber-500 text-white" : "border border-amber-400 text-amber-700 hover:bg-amber-50"
          }`}
        >
          📅 Happening Today Only
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
          <p className="text-xs font-semibold uppercase text-amber-700">Happening Today</p>
        </div>
      </div>

      {groupedByMonth.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No events match.</p>
      ) : (
        groupedByMonth.map(([month, monthRows]) => (
          <div key={month} className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900">
              {new Date(month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase text-slate-500">
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">City</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Host</th>
                    <th className="py-2 pr-3">Recurring</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {r.name}
                        {r.isToday && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">TODAY</span>}
                      </td>
                      <td className="py-2 pr-3">{r.city}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{r.category}</td>
                      <td className="py-2 pr-3">{r.hostName ?? "—"}</td>
                      <td className="py-2 pr-3">{r.recurring ? "Yes" : "No"}</td>
                      <td className="py-2 pr-3 text-slate-500">{new Date(r.date).toLocaleDateString("en-US")}</td>
                      <td className="py-2 pr-3 print:hidden">
                        <Link href={`/admin/history?type=event&id=${r.id}`} className="text-xs font-semibold text-slate-500 underline">
                          🗂️ History
                        </Link>
                      </td>
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
