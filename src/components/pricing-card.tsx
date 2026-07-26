"use client";

import { useState } from "react";
import QRCode from "qrcode";
import type { PricingTier } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export function PricingCard({ tier }: { tier: PricingTier }) {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState<"online" | "qr" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const soldOut = tier.max_slots !== null && tier.slots_claimed >= tier.max_slots;
  const slotsLeft = tier.max_slots !== null ? tier.max_slots - tier.slots_claimed : null;

  async function startCheckout(mode: "online" | "qr") {
    setError(null);
    if (!businessName.trim() || !email.trim()) {
      setError("Business name and email are required.");
      return;
    }
    setLoading(mode);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierSlug: tier.slug,
          businessName,
          contactEmail: email,
          contactPhone: phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong.");
        return;
      }
      if (mode === "online") {
        window.location.href = data.url;
      } else {
        setCheckoutUrl(data.url);
        setQrDataUrl(await QRCode.toDataURL(data.url, { width: 240, margin: 1 }));
      }
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
        {tier.is_top10 && (
          <span className="whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
            🏆 Top 10 Badge
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">
        {formatPrice(tier.price_cents, tier.currency)}
        <span className="text-sm font-medium text-slate-500"> one-time</span>
      </p>
      {tier.description && <p className="mt-2 text-sm text-slate-600">{tier.description}</p>}
      {slotsLeft !== null && (
        <p className="mt-2 text-xs font-semibold text-amber-600">
          {soldOut ? "Sold out" : `${slotsLeft} of ${tier.max_slots} spots left`}
        </p>
      )}

      {!soldOut && (
        <div className="mt-4 space-y-2">
          <input
            type="text"
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => startCheckout("online")}
              disabled={loading !== null}
              className="flex-1 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {loading === "online" ? "Redirecting…" : "Pay Online"}
            </button>
            <button
              type="button"
              onClick={() => startCheckout("qr")}
              disabled={loading !== null}
              className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === "qr" ? "Generating…" : "Show QR (in person)"}
            </button>
          </div>

          {qrDataUrl && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Scan to pay with Stripe Checkout" width={200} height={200} />
              <p className="text-center text-xs text-slate-500">
                Have the vendor scan this with their phone to pay securely via Stripe.
              </p>
              {checkoutUrl && (
                <a href={checkoutUrl} className="text-xs font-medium text-slate-700 underline">
                  Open payment link directly
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
