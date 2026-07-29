"use client";

import Link from "next/link";
import type { PricingTier } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export function PricingCard({ tier }: { tier: PricingTier }) {
  const soldOut = tier.max_slots !== null && tier.slots_claimed >= tier.max_slots;
  const slotsLeft = tier.max_slots !== null ? tier.max_slots - tier.slots_claimed : null;

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
          <Link
            href={`/vendor/signup?tier=${tier.id}`}
            className="block rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-700"
          >
            Get Started
          </Link>
          <p className="pt-1 text-center text-[11px] text-slate-400">
            Create your account first, then pay securely with Stripe — your Founding Vendor / Top
            10 badge activates automatically the moment payment clears.
          </p>
        </div>
      )}
    </div>
  );
}
