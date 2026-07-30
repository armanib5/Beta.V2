"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type Registration } from "@/lib/types";

interface ReceiptRow extends Registration {
  pricing_tiers: { name: string } | null;
}

function toCsv(rows: ReceiptRow[]): string {
  const header = ["Date", "Item", "Gross", "Stripe Fee", "Platform Fee", "Net Payout", "Stripe Payment ID"];
  const lines = rows.map((r) =>
    [
      r.paid_at ? new Date(r.paid_at).toLocaleString("en-US") : "",
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

/** Every vendor's OWN paid receipts, private to them (RLS: claimed_by_
 * vendor_id = auth.uid()) - the itemized $1.00 platform fee and Stripe's
 * estimated cut are broken out per receipt so a vendor can see exactly
 * what they were charged and what their net payout was. */
export function MyReceipts({ vendorId }: { vendorId: string }) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("registrations")
      .select("*, pricing_tiers(name)")
      .eq("claimed_by_vendor_id", vendorId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .returns<ReceiptRow[]>()
      .then(({ data }) => {
        if (cancelled) return;
        setReceipts(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const total = useMemo(() => receipts.reduce((sum, r) => sum + r.amount_cents, 0), [receipts]);

  if (loading || receipts.length === 0) return null;

  function downloadCsv() {
    const csv = toCsv(receipts);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypinned-my-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">🧾 My Receipts</h2>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⬇️ Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            🖨️ Print
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {receipts.length} paid receipt{receipts.length === 1 ? "" : "s"} — {formatPrice(total)} total
      </p>

      <div className="mt-4 space-y-2">
        {receipts.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{r.pricing_tiers?.name ?? "Purchase"}</p>
                <p className="text-xs text-slate-500">{r.paid_at ? new Date(r.paid_at).toLocaleString("en-US") : "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{formatPrice(r.amount_cents, r.currency)}</span>
                <span className="text-xs text-slate-400">{expandedId === r.id ? "▲" : "▼"}</span>
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
                    <span className="text-slate-500">Est. Stripe fee:</span>{" "}
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
                </div>
                {r.stripe_payment_intent_id && (
                  <p className="mt-2 font-mono text-xs text-slate-400">Stripe: {r.stripe_payment_intent_id}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
