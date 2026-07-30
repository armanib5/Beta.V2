"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type CartItem, type PricingTier } from "@/lib/types";
import { CheckoutTermsCheckbox, CheckoutTermsNotice, EventLiabilityCheckbox, PlatformFeeNotice } from "@/components/checkout-terms";
import { PLATFORM_FEE_CENTS } from "@/lib/fees";

interface CartRow extends CartItem {
  pricing_tiers: PricingTier | null;
}

/** Phase 1 of the cart architecture - lets a vendor add multiple flat-
 * price tiers (Founding Vendor, Top 10 Category, etc.) and pay for all of
 * them in ONE Stripe session with ONE $1.00 platform fee, instead of
 * buying each one separately through the existing "Secure Checkout"
 * buttons (still there, still works exactly as before - this is a fully
 * separate, additive path via /api/create-cart-checkout-session, not a
 * replacement). `refreshKey` bumps whenever a sibling "Add to Cart"
 * click happens elsewhere on the dashboard, since this component has no
 * other way to know the cart changed. */
export function MyCart({ vendorId, refreshKey }: { vendorId: string; refreshKey: number }) {
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("cart_items")
      .select("*, pricing_tiers(*)")
      .eq("vendor_id", vendorId)
      .order("added_at")
      .returns<CartRow[]>()
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, refreshKey]);

  async function removeItem(id: string) {
    setRemovingId(id);
    const supabase = createClient();
    await supabase.from("cart_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setRemovingId(null);
  }

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (i.pricing_tiers?.price_cents ?? 0), 0), [items]);

  async function checkoutCart() {
    if (!termsAccepted || !liabilityAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    setError(null);
    setCheckingOut(true);
    try {
      const res = await fetch("/api/create-cart-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, terms_accepted: termsAccepted && liabilityAccepted }),
      });
      const data: { url?: string; error?: string } = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout. Please try again.");
    } catch {
      setError("Could not reach payment. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">🛒 My Cart</h2>
      <p className="mt-1 text-sm text-slate-600">
        Everything here pays in one checkout with one $1.00 platform fee, instead of paying that fee separately
        for each item.
      </p>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
            <div>
              <p className="text-sm font-bold text-slate-900">{item.pricing_tiers?.name ?? "Item"}</p>
              <p className="text-xs text-slate-500">{item.pricing_tiers ? formatPrice(item.pricing_tiers.price_cents) : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={removingId === item.id}
              className="text-xs font-semibold text-red-600 underline disabled:opacity-50"
            >
              {removingId === item.id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex justify-between">
          <span>Items subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
          <span>Platform Processing Fee (once)</span>
          <span>{formatPrice(PLATFORM_FEE_CENTS)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-300 pt-2 font-bold">
          <span>Total</span>
          <span>{formatPrice(subtotal + PLATFORM_FEE_CENTS)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <PlatformFeeNotice />
        <CheckoutTermsNotice />
        <CheckoutTermsCheckbox id="cart-terms" checked={termsAccepted} onChange={setTermsAccepted} />
        <EventLiabilityCheckbox id="cart-liability-terms" checked={liabilityAccepted} onChange={setLiabilityAccepted} />
      </div>

      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={checkoutCart}
        disabled={checkingOut || !termsAccepted || !liabilityAccepted}
        className="mt-3 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {checkingOut ? "Starting checkout…" : "Secure Checkout"}
      </button>
    </div>
  );
}
