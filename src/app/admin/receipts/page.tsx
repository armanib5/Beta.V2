"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import { formatPrice, type Registration } from "@/lib/types";

interface ReceiptRow extends Registration {
  vendors: { business_name: string; lat: number | null; lng: number | null } | null;
  pricing_tiers: { name: string } | null;
}

function cityOfReceipt(r: ReceiptRow): string {
  const lat = r.vendors?.lat ?? null;
  const lng = r.vendors?.lng ?? null;
  if (lat === null || lng === null) return "Unknown";
  return nearestCityCenter(lat, lng).city;
}

function monthKeyOf(iso: string): string {
  return iso.slice(0, 7); // "2026-07"
}

const LAST_30_DAYS = "last30";

function toCsv(rows: ReceiptRow[]): string {
  const header = ["Date", "City", "Account", "Item", "Gross", "Stripe Fee", "Platform Fee", "Net Payout", "Stripe Payment ID"];
  const lines = rows.map((r) =>
    [
      r.paid_at ? new Date(r.paid_at).toLocaleString("en-US") : "",
      cityOfReceipt(r),
      r.vendors?.business_name ?? r.business_name ?? "—",
      r.pricing_tiers?.name ?? "—",
      formatPrice(r.amount_cents, r.currency),
      r.stripe_fee_cents !== null ? formatPrice(r.stripe_fee_cents, r.currency) : "—",
      r.platform_fee_cents !== null ? formatPrice(r.platform_fee_cents, r.currency) : "—",
      r.net_payout_cents !== null ? formatPrice(r.net_payout_cents, r.currency) : "—",
      r.stripe_payment_intent_id ?? "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function AdminReceiptsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>(LAST_30_DAYS);
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        .from("registrations")
        .select("*, vendors:claimed_by_vendor_id(business_name, lat, lng), pricing_tiers(name)")
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .returns<ReceiptRow[]>();
      if (cancelled) return;
      setReceipts(data ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    receipts.forEach((r) => {
      if (r.paid_at) months.add(monthKeyOf(r.paid_at));
    });
    return [...months].sort((a, b) => b.localeCompare(a));
  }, [receipts]);

  const cities = useMemo(
    () => ["All", "Unknown", ...CITY_CENTERS.map((c) => c.city).filter((v, i, a) => a.indexOf(v) === i)],
    [],
  );

  const [now] = useState(() => Date.now());

  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        if (!r.paid_at) return false;
        if (monthFilter === LAST_30_DAYS) {
          return now - new Date(r.paid_at).getTime() <= 30 * 24 * 60 * 60 * 1000;
        }
        return monthKeyOf(r.paid_at) === monthFilter;
      })
      .filter((r) => cityFilter === "All" || cityOfReceipt(r) === cityFilter);
  }, [receipts, monthFilter, cityFilter, now]);

  // Multiple registrations can share one stripe_checkout_session_id - a
  // cart checkout pays for N items in one Stripe session (see
  // handleCreateCartCheckoutSession in worker/index.ts), so those should
  // read as one order here, not N unrelated receipts.
  const groupedByCity = useMemo(() => {
    const map = new Map<string, ReceiptRow[][]>();
    for (const r of filteredReceipts) {
      const city = cityOfReceipt(r);
      const orders = map.get(city) ?? [];
      const existingOrder = r.stripe_checkout_session_id
        ? orders.find((o) => o[0].stripe_checkout_session_id === r.stripe_checkout_session_id)
        : undefined;
      if (existingOrder) existingOrder.push(r);
      else orders.push([r]);
      map.set(city, orders);
    }
    for (const orders of map.values()) {
      orders.sort((a, b) => (b[0].paid_at ?? "").localeCompare(a[0].paid_at ?? ""));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredReceipts]);

  const total = useMemo(() => filteredReceipts.reduce((sum, r) => sum + r.amount_cents, 0), [filteredReceipts]);
  const totalPlatformFees = useMemo(
    () => filteredReceipts.reduce((sum, r) => sum + (r.platform_fee_cents ?? 0), 0),
    [filteredReceipts],
  );

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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

  function downloadCsv() {
    const csv = toCsv(filteredReceipts);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-receipts-${monthFilter}-${cityFilter.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">🧾 All Receipts</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Every paid checkout across every account — sorted by city, most recent first within each city. Click a
        receipt to see the full itemized breakdown.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <option value={LAST_30_DAYS}>Last 30 Days</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{filteredReceipts.length}</p>
          <p className="text-xs font-semibold uppercase text-slate-500">Receipts</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-800">{formatPrice(total)}</p>
          <p className="text-xs font-semibold uppercase text-green-700">Total Collected</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 print:hidden">
        Platform Processing Fees in this view: {formatPrice(totalPlatformFees)}
      </p>

      {groupedByCity.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No receipts match.</p>
      ) : (
        groupedByCity.map(([city, cityOrders]) => (
          <div key={city} className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900">
              {city} <span className="text-sm font-normal text-slate-500">({cityOrders.reduce((n, o) => n + o.length, 0)})</span>
            </h2>
            <div className="mt-2 space-y-2">
              {cityOrders.map((order) => {
                const first = order[0];
                const orderTotal = order.reduce((sum, r) => sum + r.amount_cents, 0);
                const orderKey = first.stripe_checkout_session_id ?? first.id;
                return (
                  <div key={orderKey} className="rounded-xl border border-slate-200 bg-white">
                    {order.length > 1 && (
                      <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                        🛒 {order.length}-item order
                      </p>
                    )}
                    {order.map((r) => (
                      <div key={r.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {r.vendors?.business_name ?? r.business_name ?? "—"}{" "}
                              <span className="font-normal text-slate-500">— {r.pricing_tiers?.name ?? "Purchase"}</span>
                            </p>
                            <p className="text-xs text-slate-500">{r.paid_at ? new Date(r.paid_at).toLocaleString("en-US") : "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{formatPrice(r.amount_cents, r.currency)}</span>
                            <span className="text-xs text-slate-400 print:hidden">{expandedId === r.id ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        {expandedId === r.id && (
                          <div className="border-t border-slate-100 px-4 py-3 text-sm">
                            <div className="grid gap-1 sm:grid-cols-2">
                              <p>
                                <span className="text-slate-500">Gross amount:</span>{" "}
                                <span className="font-medium text-slate-900">{formatPrice(r.amount_cents, r.currency)}</span>
                              </p>
                              <p>
                                <span className="text-slate-500">Platform Processing Fee:</span>{" "}
                                <span className="font-medium text-slate-900">
                                  {r.platform_fee_cents !== null ? formatPrice(r.platform_fee_cents, r.currency) : "—"}
                                </span>
                              </p>
                              <p>
                                <span className="text-slate-500">Est. Stripe fee (this item&apos;s share):</span>{" "}
                                <span className="font-medium text-slate-900">
                                  {r.stripe_fee_cents !== null ? formatPrice(r.stripe_fee_cents, r.currency) : "—"}
                                </span>
                              </p>
                              <p>
                                <span className="text-slate-500">Net payout:</span>{" "}
                                <span className="font-medium text-slate-900">
                                  {r.net_payout_cents !== null ? formatPrice(r.net_payout_cents, r.currency) : "—"}
                                </span>
                              </p>
                              <p>
                                <span className="text-slate-500">Contact:</span>{" "}
                                <span className="font-medium text-slate-900">{r.contact_email}</span>
                              </p>
                            </div>
                            {r.stripe_payment_intent_id && (
                              <p className="mt-2 font-mono text-xs text-slate-400">Stripe: {r.stripe_payment_intent_id}</p>
                            )}
                            <Link
                              href={`/admin/history?type=vendor&id=${r.claimed_by_vendor_id ?? ""}`}
                              className="mt-2 inline-block text-xs font-semibold text-slate-500 underline print:hidden"
                            >
                              🗂️ View account history
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                    {order.length > 1 && (
                      <p className="border-t border-slate-100 px-4 py-2 text-right text-sm font-bold text-slate-900">
                        Order total: {formatPrice(orderTotal, first.currency)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
