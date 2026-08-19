"use client";

import { useState } from "react";
import QRCode from "qrcode";
import type { PricingTier } from "@/lib/types";
import { formatPrice } from "@/lib/types";

/**
 * `tone="dark"` is the Home Screen's black/chrome glass skin — presentation
 * only: the tier data, Stripe payment link and QR generation below are
 * identical in both tones.
 */
export function PricingCard({
  tier,
  tone = "light",
}: {
  tier: PricingTier;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const soldOut = tier.max_slots !== null && tier.slots_claimed >= tier.max_slots;
  const slotsLeft = tier.max_slots !== null ? tier.max_slots - tier.slots_claimed : null;
  const paymentLink = tier.stripe_payment_link;

  async function showQr() {
    if (!paymentLink) return;
    setGeneratingQr(true);
    try {
      setQrDataUrl(await QRCode.toDataURL(paymentLink, { width: 240, margin: 1 }));
    } finally {
      setGeneratingQr(false);
    }
  }

  return (
    <div
      className={
        dark
          ? "cp-glass flex flex-col p-6"
          : "flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={dark ? "cp-chrome-text text-lg font-bold" : "text-lg font-bold text-slate-900"}>
          {tier.name}
        </h3>
        {tier.is_top10 && (
          <span
            className={
              dark
                ? "cp-btn whitespace-nowrap px-3 py-1 text-xs font-bold text-slate-100"
                : "whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900"
            }
          >
            🏆 Top 10 Badge
          </span>
        )}
      </div>
      <p className={dark ? "cp-chrome-text mt-2 text-3xl font-extrabold" : "mt-2 text-3xl font-extrabold text-slate-900"}>
        {formatPrice(tier.price_cents, tier.currency)}
        <span className={dark ? "text-sm font-medium text-slate-400" : "text-sm font-medium text-slate-500"}>
          {" "}
          one-time
        </span>
      </p>
      {tier.description && (
        <p className={dark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-600"}>
          {tier.description}
        </p>
      )}
      {slotsLeft !== null && (
        <p className={dark ? "mt-2 text-xs font-semibold text-slate-300" : "mt-2 text-xs font-semibold text-amber-600"}>
          {soldOut ? "Sold out" : `${slotsLeft} of ${tier.max_slots} spots left`}
        </p>
      )}

      {!soldOut && (
        <div className="mt-4 space-y-2">
          {paymentLink ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  dark
                    ? "cp-btn cp-press flex-1 px-4 py-2.5 text-center text-sm font-bold text-slate-100"
                    : "flex-1 rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-700"
                }
              >
                Pay Online
              </a>
              <button
                type="button"
                onClick={showQr}
                disabled={generatingQr}
                className={
                  dark
                    ? "cp-glass cp-press flex-1 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-60"
                    : "flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                }
              >
                {generatingQr ? "Generating…" : "Show QR (in person)"}
              </button>
            </div>
          ) : (
            <p className={dark ? "cp-inset px-3 py-2 text-xs text-slate-400" : "rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"}>
              Payment link coming soon — check back shortly.
            </p>
          )}

          {qrDataUrl && (
            <div
              className={
                dark
                  ? "cp-matte-panel mt-3 flex flex-col items-center gap-2 p-4"
                  : "mt-3 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Scan to pay with Stripe" width={200} height={200} />
              <p className={dark ? "text-center text-xs text-slate-400" : "text-center text-xs text-slate-500"}>
                Have the vendor scan this with their phone to pay securely via Stripe.
              </p>
            </div>
          )}

          <p className={dark ? "pt-1 text-center text-[11px] text-slate-500" : "pt-1 text-center text-[11px] text-slate-400"}>
            After paying, come back and create your vendor login — your account is reviewed and
            activated manually for now.
          </p>
        </div>
      )}
    </div>
  );
}
