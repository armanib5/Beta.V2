"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/site";
import {
  formatPrice,
  type AccountLegalAgreement,
  type Category,
  type LovEntry,
  type MenuItem,
  type PricingTier,
  type Vendor,
  type VendorBoostBooking,
  type VendorPhoto,
} from "@/lib/types";
import { VendorPhotoManager } from "@/components/vendor-photo-manager";
import { MenuHubManager } from "@/components/menu-hub-manager";
import { MyListingManager } from "@/components/my-listing-manager";
import { MyReceipts } from "@/components/my-receipts";
import { MyCart } from "@/components/my-cart";
import { CheckoutTermsCheckbox, CheckoutTermsNotice, EventLiabilityCheckbox, PlatformFeeNotice } from "@/components/checkout-terms";
import { CART_INELIGIBLE_TIER_SLUGS, PLATFORM_FEE_CENTS } from "@/lib/fees";
import type { VendorStatus } from "@/lib/types";

const STATUS_DISPLAY: Record<VendorStatus, { label: string; style: string }> = {
  active: { label: "✅ Approved / Active", style: "border-green-300 bg-green-50 text-green-800" },
  pending: { label: "⏳ Unapproved / Pending Review", style: "border-amber-300 bg-amber-50 text-amber-800" },
  suspended: { label: "⏸ Suspended / Inactive", style: "border-orange-300 bg-orange-50 text-orange-800" },
  rejected: { label: "✕ Not Approved", style: "border-red-300 bg-red-50 text-red-800" },
};

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const SLOT_MS = 10 * 60 * 1000;
const MAX_PER_SLOT = 5;
const AVAILABILITY_WINDOW_HOURS = 4;

function nextBucketStart(fromMs: number): number {
  return Math.ceil(fromMs / SLOT_MS) * SLOT_MS;
}

function formatHourLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric" });
}

function formatSlotLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type BoostStep = "pick" | "slots" | "summary";

/** Quick Boost ($15, pick 2 of the available 10-minute slots - up to 5
 * vendors can share any one slot) and Top 10 Placement ($30, 30 straight
 * minutes starting now) - both independent of and parallel-friendly with
 * the permanent Top 10/Founding tiers below, and both add a $1 CityPinned
 * service fee shown as its own line before payment. Neither ever touches
 * approval status or the permanent badges; "currently boosted" is read
 * from vendor_boost_bookings (a slot can be scheduled for later), not a
 * single vendor column. */
function QuickBoost({ vendor, tiers }: { vendor: Vendor; tiers: PricingTier[] }) {
  const boostTier = tiers.find((t) => t.slug === "vendor-boost");
  const placementTier = tiers.find((t) => t.slug === "top10-30min");
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState<BoostStep>("pick");
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [availability, setAvailability] = useState<Map<number, number> | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [myBookings, setMyBookings] = useState<VendorBoostBooking[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("vendor_boost_bookings")
      .select("*")
      .eq("vendor_id", vendor.id)
      .gte("slot_end", new Date().toISOString())
      .order("slot_start")
      .returns<VendorBoostBooking[]>()
      .then(({ data }) => setMyBookings(data ?? []));
  }, [vendor.id]);

  const activeBooking = myBookings.find(
    (b) => new Date(b.slot_start).getTime() <= now && now < new Date(b.slot_end).getTime(),
  );
  const nextBooking = !activeBooking ? myBookings.find((b) => new Date(b.slot_start).getTime() > now) : undefined;

  async function loadAvailability() {
    setLoadingAvailability(true);
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/purity -- runs only inside this async click handler, never during render
    const windowStart = nextBucketStart(Date.now());
    const windowEnd = windowStart + AVAILABILITY_WINDOW_HOURS * 60 * 60 * 1000;
    const { data } = await supabase
      .from("vendor_boost_bookings")
      .select("slot_start")
      .gte("slot_start", new Date(windowStart).toISOString())
      .lt("slot_start", new Date(windowEnd).toISOString())
      .returns<{ slot_start: string }[]>();
    const counts = new Map<number, number>();
    for (let t = windowStart; t < windowEnd; t += SLOT_MS) counts.set(t, 0);
    (data ?? []).forEach((row) => {
      const bucket = Math.floor(new Date(row.slot_start).getTime() / SLOT_MS) * SLOT_MS;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    });
    setAvailability(counts);
    setLoadingAvailability(false);
  }

  function chooseTier(tier: PricingTier) {
    setSelectedTier(tier);
    setSelectedSlots([]);
    setError(null);
    if (tier.slug === "vendor-boost") {
      setStep("slots");
      loadAvailability();
    } else {
      setStep("summary");
    }
  }

  function toggleSlot(bucketMs: number, full: boolean) {
    if (full) return;
    setSelectedSlots((prev) => {
      if (prev.includes(bucketMs)) return prev.filter((s) => s !== bucketMs);
      if (prev.length >= 2) return [prev[1], bucketMs];
      return [...prev, bucketMs];
    });
  }

  async function confirmAndPay() {
    if (!selectedTier) return;
    if (!termsAccepted || !liabilityAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    setError(null);
    setCheckingOut(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          vendor_id: vendor.id,
          tier_id: selectedTier.id,
          slots: selectedTier.slug === "vendor-boost" ? selectedSlots.map((ms) => new Date(ms).toISOString()) : undefined,
          terms_accepted: termsAccepted && liabilityAccepted,
        }),
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

  if (!boostTier && !placementTier) return null;

  const hourGroups: number[][] = [];
  if (availability) {
    let currentHour = -1;
    for (const bucketMs of availability.keys()) {
      const hour = new Date(bucketMs).getHours();
      if (hour !== currentHour) {
        hourGroups.push([]);
        currentHour = hour;
      }
      hourGroups[hourGroups.length - 1].push(bucketMs);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <h2 className="text-lg font-bold text-slate-900">⚡ Boost Your Listing</h2>

      {activeBooking && (
        <p className="mt-2 inline-block rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900">
          🔥 BOOSTED — {formatCountdown(new Date(activeBooking.slot_end).getTime() - now)} left
        </p>
      )}
      {!activeBooking && nextBooking && (
        <p className="mt-2 text-sm font-semibold text-amber-800">
          ⏰ Next boost scheduled for {formatSlotLabel(new Date(nextBooking.slot_start).getTime())}
        </p>
      )}

      {step === "pick" && (
        <>
          <p className="mt-1 text-sm text-slate-700">Choose how you want to boost your listing.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boostTier && (
              <button
                type="button"
                onClick={() => chooseTier(boostTier)}
                className="rounded-xl border-2 border-slate-300 bg-white p-4 text-left hover:border-amber-400"
              >
                <p className="font-bold text-slate-900">⚡ Quick Boost — {formatPrice(boostTier.price_cents)}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Pick 2 of the available 10-minute slots (same hour or spread across the day). Gold badge +
                  sorted-to-top on the Map and Directory during each slot.
                </p>
              </button>
            )}
            {placementTier && (
              <button
                type="button"
                onClick={() => chooseTier(placementTier)}
                className="rounded-xl border-2 border-slate-300 bg-white p-4 text-left hover:border-amber-400"
              >
                <p className="font-bold text-slate-900">🏆 Top 10 Placement — {formatPrice(placementTier.price_cents)}</p>
                <p className="mt-1 text-xs text-slate-600">
                  30 straight minutes of gold badge + sorted-to-top placement, starting the moment you pay.
                </p>
              </button>
            )}
          </div>
        </>
      )}

      {step === "slots" && selectedTier && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              Pick 2 slots ({selectedSlots.length}/2 selected) — max {MAX_PER_SLOT} vendors per slot
            </p>
            <button type="button" onClick={() => setStep("pick")} className="text-xs font-semibold text-slate-500 underline">
              ← Back
            </button>
          </div>
          {loadingAvailability && <p className="mt-2 text-sm text-slate-500">Loading available times…</p>}
          {availability && (
            <div className="mt-3 space-y-3">
              {hourGroups.map((bucketMsList) => (
                <div key={bucketMsList[0]}>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatHourLabel(bucketMsList[0])}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {bucketMsList.map((bucketMs) => {
                      const count = availability.get(bucketMs) ?? 0;
                      const full = count >= MAX_PER_SLOT;
                      const selected = selectedSlots.includes(bucketMs);
                      return (
                        <button
                          key={bucketMs}
                          type="button"
                          disabled={full}
                          onClick={() => toggleSlot(bucketMs, full)}
                          title={full ? "Full" : `${MAX_PER_SLOT - count} of ${MAX_PER_SLOT} left`}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            full
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                              : selected
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:border-amber-400"
                          }`}
                        >
                          :{String(new Date(bucketMs).getMinutes()).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={selectedSlots.length !== 2}
            onClick={() => setStep("summary")}
            className="mt-4 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === "summary" && selectedTier && (
        <div className="mt-4 max-w-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Checkout Summary</p>
            <button
              type="button"
              onClick={() => setStep(selectedTier.slug === "vendor-boost" ? "slots" : "pick")}
              className="text-xs font-semibold text-slate-500 underline"
            >
              ← Back
            </button>
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex justify-between">
              <span>{selectedTier.name}</span>
              <span>{formatPrice(selectedTier.price_cents)}</span>
            </div>
            {selectedTier.slug === "vendor-boost" && selectedSlots.length === 2 && (
              <p className="mt-1 text-xs text-slate-500">
                Slots: {formatSlotLabel(selectedSlots[0])} and {formatSlotLabel(selectedSlots[1])}
              </p>
            )}
            {selectedTier.slug === "top10-30min" && <p className="mt-1 text-xs text-slate-500">Starts immediately on payment.</p>}
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
              <span>Platform Processing Fee</span>
              <span>{formatPrice(PLATFORM_FEE_CENTS)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span>Total</span>
              <span>{formatPrice(selectedTier.price_cents + PLATFORM_FEE_CENTS)}</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <PlatformFeeNotice />
            <CheckoutTermsNotice />
            <CheckoutTermsCheckbox id="boost-terms" checked={termsAccepted} onChange={setTermsAccepted} />
            <EventLiabilityCheckbox id="boost-liability-terms" checked={liabilityAccepted} onChange={setLiabilityAccepted} />
          </div>
          <button
            type="button"
            onClick={confirmAndPay}
            disabled={checkingOut || !termsAccepted || !liabilityAccepted}
            className="mt-3 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {checkingOut ? "Starting checkout…" : "Secure Checkout"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

function BoostRequest({
  vendor,
  tiers,
  onAddedToCart,
}: {
  vendor: Vendor;
  tiers: PricingTier[];
  onAddedToCart: () => void;
}) {
  const [requestedAt, setRequestedAt] = useState(vendor.boost_requested_at);
  const [requesting, setRequesting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [checkoutTierId, setCheckoutTierId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [addingTierId, setAddingTierId] = useState<string | null>(null);

  async function addToCart(tier: PricingTier) {
    setCheckoutError(null);
    setAddingTierId(tier.id);
    const supabase = createClient();
    const { error } = await supabase.from("cart_items").insert({ vendor_id: vendor.id, tier_id: tier.id });
    setAddingTierId(null);
    if (error) {
      // Unique (vendor_id, tier_id) violation just means it's already in
      // the cart - not worth surfacing as an error, "My Cart" already
      // shows it's there.
      if (error.code !== "23505") setCheckoutError(error.message);
      return;
    }
    onAddedToCart();
  }

  async function payWithStripe(tier: PricingTier) {
    if (!termsAccepted || !liabilityAccepted) {
      setCheckoutError("Please accept the Terms of Service to continue.");
      return;
    }
    setCheckoutError(null);
    setCheckoutTierId(tier.id);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ vendor_id: vendor.id, tier_id: tier.id, terms_accepted: termsAccepted && liabilityAccepted }),
      });
      const data: { url?: string; error?: string } = await res.json();
      if (res.ok && data.url) {
        // eslint-disable-next-line react-hooks/immutability -- navigation runs only inside this async click handler, never during render
        window.location.href = data.url;
        return;
      }
      setCheckoutError(data.error ?? "Could not start checkout. Please try again.");
    } catch {
      setCheckoutError("Could not reach payment. Please try again.");
    } finally {
      setCheckoutTierId(null);
    }
  }

  if (vendor.is_top10) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">🏆 You&apos;re Top 10 / Featured</h2>
        <p className="mt-1 text-sm text-slate-700">All premium badges are already active on your listing.</p>
      </div>
    );
  }

  async function requestBoost() {
    setRequesting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("vendors")
      .update({ boost_requested_at: new Date().toISOString() })
      .eq("id", vendor.id);
    setRequesting(false);
    if (!error) setRequestedAt(new Date().toISOString());
  }

  async function redeemCode(e: React.FormEvent) {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setRedeeming(true);
    setRedeemError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: promoCode.trim().toUpperCase() });
    setRedeeming(false);
    if (error || !data?.ok) {
      setRedeemError(error?.message ?? data?.error ?? "Could not redeem that code.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Boost / Feature Your Listing</h2>
      <p className="mt-1 text-sm text-slate-600">
        Get a gold Top 10 badge and priority placement across the Board, Map, and Directory.
      </p>
      {vendor.opens_at && new Date(vendor.opens_at) > new Date() && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          📅 Your flyer will show &quot;Opens {new Date(vendor.opens_at).toLocaleDateString("en-US")}&quot; until
          then, even while boosted/featured — boosting doesn&apos;t make you show as open early.
        </p>
      )}
      {tiers.length > 0 && (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <PlatformFeeNotice />
          <CheckoutTermsNotice />
          <CheckoutTermsCheckbox id="upgrade-terms" checked={termsAccepted} onChange={setTermsAccepted} />
          <EventLiabilityCheckbox id="upgrade-liability-terms" checked={liabilityAccepted} onChange={setLiabilityAccepted} />
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tiers.map((tier) => (
          <div key={tier.id} className="rounded-xl border border-slate-200 p-4">
            <p className="font-bold text-slate-900">{tier.name}</p>
            <p className="text-sm text-slate-600">
              {formatPrice(tier.price_cents)} + {formatPrice(PLATFORM_FEE_CENTS)} fee ={" "}
              <span className="font-semibold text-slate-900">{formatPrice(tier.price_cents + PLATFORM_FEE_CENTS)}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => payWithStripe(tier)}
                disabled={checkoutTierId === tier.id || !termsAccepted || !liabilityAccepted}
                className="inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {checkoutTierId === tier.id ? "Starting checkout…" : "Secure Checkout"}
              </button>
              {!CART_INELIGIBLE_TIER_SLUGS.includes(tier.slug) && (
                <button
                  type="button"
                  onClick={() => addToCart(tier)}
                  disabled={addingTierId === tier.id}
                  className="inline-block rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {addingTierId === tier.id ? "Adding…" : "🛒 Add to Cart"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {checkoutError && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{checkoutError}</p>}
      <p className="mt-4 text-xs text-slate-500">
        Paying with Stripe above activates your badge automatically, usually within seconds. Paid
        another way (cash, check, in person)?
      </p>
      {requestedAt ? (
        <p className="mt-1 text-sm font-medium text-amber-700">
          ⏳ Requested {new Date(requestedAt).toLocaleDateString("en-US")} — an admin will review and activate it.
        </p>
      ) : (
        <button
          type="button"
          onClick={requestBoost}
          disabled={requesting}
          className="mt-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {requesting ? "Requesting…" : "Request manual activation"}
        </button>
      )}

      <form onSubmit={redeemCode} className="mt-6 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Have a promo code?</label>
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </div>
        <button
          type="submit"
          disabled={redeeming}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
        {redeemError && <p role="alert" className="w-full text-xs font-medium text-red-600">{redeemError}</p>}
      </form>
    </div>
  );
}

export function VendorDashboard({
  vendor,
  categories,
  selectedCategoryIds,
  photos,
  tiers,
  myListings,
  menuItems,
}: {
  vendor: Vendor;
  categories: Category[];
  selectedCategoryIds: string[];
  photos: VendorPhoto[];
  tiers: PricingTier[];
  myListings: LovEntry[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const isMenuHubEntity = vendor.entity_type === "restaurant" || vendor.entity_type === "bar";
  const [cartRefreshKey, setCartRefreshKey] = useState(0);

  const [form, setForm] = useState({
    business_name: vendor.business_name,
    owner_name: vendor.owner_name ?? "",
    phone: vendor.phone ?? "",
    instagram_handle: vendor.instagram_handle ?? "",
    website_url: vendor.website_url ?? "",
    short_description: vendor.short_description ?? "",
    opens_at: vendor.opens_at ?? "",
  });
  const [hubType, setHubType] = useState(vendor.hub_type);
  const [savingHubType, setSavingHubType] = useState(false);
  const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({
    lat: vendor.lat,
    lng: vendor.lng,
  });
  const [locating, setLocating] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set(selectedCategoryIds));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check location permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveHubType(next: typeof hubType) {
    setSavingHubType(true);
    setError(null);
    const supabase = createClient();
    const { error: hubError } = await supabase.from("vendors").update({ hub_type: next }).eq("id", vendor.id);
    setSavingHubType(false);
    if (hubError) {
      setError(hubError.message || "Couldn't switch your hub type. Please try again.");
      return;
    }
    setHubType(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const supabase = createClient();

      const { error: profileError } = await supabase
        .from("vendors")
        .update({
          business_name: form.business_name,
          owner_name: form.owner_name || null,
          phone: form.phone || null,
          instagram_handle: form.instagram_handle || null,
          website_url: form.website_url || null,
          short_description: form.short_description || null,
          opens_at: form.opens_at || null,
          lat: location.lat,
          lng: location.lng,
        })
        .eq("id", vendor.id);
      if (profileError) throw profileError;

      const toAdd = [...selectedCategories].filter((id) => !selectedCategoryIds.includes(id));
      const toRemove = selectedCategoryIds.filter((id) => !selectedCategories.has(id));

      if (toAdd.length) {
        const { error: addError } = await supabase
          .from("vendor_categories")
          .insert(toAdd.map((category_id) => ({ vendor_id: vendor.id, category_id })));
        if (addError) throw addError;
      }
      if (toRemove.length) {
        const { error: removeError } = await supabase
          .from("vendor_categories")
          .delete()
          .eq("vendor_id", vendor.id)
          .in("category_id", toRemove);
        if (removeError) throw removeError;
      }

      setSavedMessage("Saved!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusDisplay = STATUS_DISPLAY[vendor.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-extrabold ${statusDisplay.style}`}
      >
        {statusDisplay.label}
      </div>
      {vendor.status === "pending" && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {vendor.tier_id ? (
            <>
              <strong>Pending review.</strong> We&apos;ll activate your account after confirming your
              payment — finish setting up your profile below in the meantime.
            </>
          ) : (
            <>
              <strong>Pending review.</strong> Your free listing is waiting on admin approval before
              it goes live — no payment is needed for this. Finish setting up your profile below in
              the meantime.
            </>
          )}
        </div>
      )}
      {vendor.status === "suspended" && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your account is currently suspended. Contact us if you think this is a mistake.
        </div>
      )}
      {vendor.status === "rejected" && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your account was not approved. Contact us if you think this is a mistake or want to
          resubmit.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{vendor.business_name}</h1>
            {vendor.is_founding_vendor && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                Founding Vendor
              </span>
            )}
            {vendor.is_top10 && (
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                🏆 Top 10
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Public profile:{" "}
            <Link href={`/vendor?slug=${encodeURIComponent(vendor.slug)}`} className="underline">
              /vendor?slug={vendor.slug}
            </Link>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            <Link href="/vendor/zones" className="underline">
              Claim a booth at an upcoming event →
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sign Out
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Photos &amp; Logo</h2>
        <div className="mt-4">
          <VendorPhotoManager
            vendorId={vendor.id}
            logoUrl={vendor.logo_url}
            logoFocalX={vendor.logo_focal_x}
            logoFocalY={vendor.logo_focal_y}
            initialPhotos={photos}
          />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Account Type</h2>
        <p className="mt-1 text-sm text-slate-600">
          What kind of hub is this account? This controls which button people see when they tap through from a
          flyer or the Directory.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { key: "vendor" as const, label: "🛒 Vendor Hub", desc: "A pop-up vendor at events (booths, boost/Top 10)." },
              { key: "menu" as const, label: "🍽️ Menu Hub", desc: "A restaurant/bar with its own menu, specials, and Top Picks." },
              { key: "hosting" as const, label: "🏠 Hosting Hub", desc: "A venue that hosts other people's events at your location." },
              { key: "show" as const, label: "🎭 Show Hub", desc: "A theater or performance center hosting ticketed shows." },
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={savingHubType}
              onClick={() => saveHubType(opt.key)}
              className={`rounded-xl border p-3 text-left text-sm disabled:opacity-60 ${
                hubType === opt.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="font-bold">{opt.label}</p>
              <p className={`mt-0.5 text-xs ${hubType === opt.key ? "text-slate-300" : "text-slate-500"}`}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <MyListingManager vendorId={vendor.id} initialListings={myListings} />

      {isMenuHubEntity && (
        <MenuHubManager vendorId={vendor.id} menuHubEnabled={vendor.menu_hub_enabled} initialItems={menuItems} />
      )}

      <QuickBoost vendor={vendor} tiers={tiers} />

      <BoostRequest vendor={vendor} tiers={tiers} onAddedToCart={() => setCartRefreshKey((k) => k + 1)} />

      <MyCart vendorId={vendor.id} refreshKey={cartRefreshKey} />

      <MyReceipts vendorId={vendor.id} />

      <form onSubmit={handleSave} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => updateField("business_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="Owner name">
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Opening date (optional)">
            <input
              type="date"
              value={form.opens_at}
              onChange={(e) => updateField("opens_at", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Set this if you&apos;re boosting/featuring before you actually open — the flyer badge will show
              your real opening date instead of a misleading &quot;Open Now.&quot;
            </span>
          </Field>
          <Field label="Instagram handle">
            <input
              type="text"
              placeholder="@yourbusiness"
              value={form.instagram_handle}
              onChange={(e) => updateField("instagram_handle", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input
              type="url"
              placeholder="https://"
              value={form.website_url}
              onChange={(e) => updateField("website_url", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <textarea
              rows={3}
              maxLength={280}
              value={form.short_description}
              onChange={(e) => updateField("short_description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Location</p>
          <p className="mt-1 text-xs text-slate-500">
            This is the exact spot your business marker shows up on the public Map, and it powers &quot;Near
            You&quot; sorting on the Vendor Directory — e.g. a customer searching near Santana Row sees you first if
            your pin is placed there. Setting it here doesn&apos;t change your business address, just where the pin
            sits.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {locating ? "Locating…" : "📍 Use My Current Location"}
            </button>
            {/* GPS needs a permission grant and being physically at the
               storefront - neither is guaranteed while filling this out.
               "Manage My Pin" already lets a vendor place their pin by
               tapping anywhere on a real map instead, with no GPS or new
               geocoding system needed - it's the same vendors.lat/lng
               fields, just a fuller editor (public/pins/js/pins.js). */}
            <a
              href={`${BASE_PATH}/pins/`}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              🗺️ Set Address on Map
            </a>
            {location.lat !== null && location.lng !== null && (
              <span className="text-xs text-slate-500">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Category tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = selectedCategories.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {category.icon} {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm font-medium text-green-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <AccountLoginSettings vendor={vendor} />
    </div>
  );
}

/** Lets a vendor set up their own real email/password — for accounts the
 * admin comped with a PIN and a placeholder @vendor.citypinned.app
 * address, this is how they take over their own login going forward. */
function AccountLoginSettings({ vendor }: { vendor: Vendor }) {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestAgreement, setLatestAgreement] = useState<AccountLegalAgreement | null>(null);
  const [regeneratingPin, setRegeneratingPin] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null));
    supabase
      .from("account_legal_agreements")
      .select("*")
      .eq("user_id", vendor.id)
      .order("agreed_at", { ascending: false })
      .limit(1)
      .maybeSingle<AccountLegalAgreement>()
      .then(({ data }) => setLatestAgreement(data));
  }, [vendor.id]);

  const isPinLogin = (sessionEmail ?? vendor.contact_email).endsWith("@vendor.citypinned.app");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!newEmail && !newPassword) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const update: { email?: string; password?: string } = {};
      if (newEmail) update.email = newEmail;
      if (newPassword) update.password = newPassword;
      const { error: updateError } = await supabase.auth.updateUser(update);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMessage(
        newEmail
          ? "Check your new email for a confirmation link to finish the switch."
          : "Password updated.",
      );
      setNewEmail("");
      setNewPassword("");
    } finally {
      setSaving(false);
    }
  }

  // Self-service PIN rotation for a vendor who's already logged in - not a
  // "forgot PIN" recovery path (that inherently requires already being
  // authenticated), just a way to get a fresh one, e.g. after sharing the
  // old one with a temp worker. A genuinely locked-out vendor needs an
  // admin to reset it from Accounts Directory instead.
  async function regeneratePin() {
    if (!window.confirm("Get a new Business PIN? Your old PIN stops working immediately.")) return;
    setPinError(null);
    setNewPin(null);
    setRegeneratingPin(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPinError("Your session expired — please log in again.");
        return;
      }
      const res = await fetch("/api/vendor-regenerate-pin", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      });
      const data: { pin?: string; error?: string } = await res.json();
      if (!res.ok || !data.pin) {
        setPinError(data.error ?? "Could not get a new PIN.");
        return;
      }
      setNewPin(data.pin);
    } catch {
      setPinError("Could not reach the server. Please try again.");
    } finally {
      setRegeneratingPin(false);
    }
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-bold text-slate-900">Account Login</h2>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="font-medium text-slate-900">{sessionEmail ?? vendor.contact_email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Login method</p>
          <p className="font-medium text-slate-900">{isPinLogin ? "Business ID + PIN" : "Email + password"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business ID (PIN login)</p>
          <p className="font-mono font-medium text-slate-900">{vendor.slug}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account ID</p>
          <p className="truncate font-mono text-xs font-medium text-slate-900" title={vendor.id}>
            {vendor.id}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        A password can&apos;t be shown once set (nobody — including us — can read it back), only replaced.
        Your Account ID never changes no matter how you log in, so it stays the same if this account is ever
        moved to a future version of CityPinned.
      </p>

      {isPinLogin && (
        <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Business PIN</p>
          <p className="mt-1 text-xs text-slate-600">
            Get a new PIN below (e.g. after sharing the old one with someone). If you&rsquo;re locked out and can&rsquo;t
            log in at all to get here, ask an admin to reset your PIN instead — there&rsquo;s no self-service recovery
            for a forgotten PIN, only a fresh one once you&rsquo;re already signed in.
          </p>
          {newPin ? (
            <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3">
              <p className="text-xs font-bold text-green-900">✅ New PIN — it won&rsquo;t be shown again</p>
              <p className="mt-1 font-mono text-base font-bold text-slate-900">{newPin}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={regeneratePin}
              disabled={regeneratingPin}
              className="mt-3 rounded-full border border-purple-300 bg-white px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              {regeneratingPin ? "Getting new PIN…" : "🔑 Get a New PIN"}
            </button>
          )}
          {pinError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{pinError}</p>}
        </div>
      )}

      {latestAgreement && (
        <p className="mt-3 inline-block rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
          ✅ Terms &amp; Event Liability Agreement accepted on{" "}
          {new Date(latestAgreement.agreed_at).toLocaleString("en-US")} (Version: {latestAgreement.terms_version})
        </p>
      )}

      <p className="mt-4 text-sm text-slate-600">
        Set your own email and/or password below whenever you&rsquo;re ready — you don&rsquo;t have to keep
        using a PIN. This updates your login on our server, so it takes effect immediately on every device,
        not just this one.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 max-w-sm space-y-3">
        <input
          type="email"
          placeholder="New email (optional)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          placeholder="New password (optional)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        {message && <p className="text-sm font-medium text-green-600">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Update Login"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
