"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import type { LovEntry, PricingTier, Vendor, VendorBoostBooking } from "@/lib/types";

const SLOT_MS = 10 * 60 * 1000;
const MAX_PER_SLOT = 5;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function nextBucketStart(fromMs: number): number {
  return Math.ceil(fromMs / SLOT_MS) * SLOT_MS;
}

export default function AdminPlacementsPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [bookings, setBookings] = useState<VendorBoostBooking[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [grantVendorId, setGrantVendorId] = useState("");
  const [grantTierSlug, setGrantTierSlug] = useState<"vendor-boost" | "top10-30min">("vendor-boost");
  const [granting, setGranting] = useState(false);
  const [addEventId, setAddEventId] = useState("");
  const [addingEventTop10, setAddingEventTop10] = useState(false);
  const [removingEventId, setRemovingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const supabase = createClient();
    const [{ data: bookingRows }, { data: vendorRows }, { data: tierRows }, { data: eventRows }] = await Promise.all([
      supabase.from("vendor_boost_bookings").select("*").order("slot_start", { ascending: false }).returns<VendorBoostBooking[]>(),
      supabase.from("vendors").select("*").returns<Vendor[]>(),
      supabase.from("pricing_tiers").select("*").returns<PricingTier[]>(),
      supabase.from("lov_entries").select("*").eq("type", "event").eq("status", "active").order("name").returns<LovEntry[]>(),
    ]);
    setBookings(bookingRows ?? []);
    setVendors(vendorRows ?? []);
    setTiers(tierRows ?? []);
    setEvents(eventRows ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      await loadData();
      if (cancelled) return;
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const activeVendors = useMemo(
    () => vendors.filter((v) => v.status === "active").sort((a, b) => a.business_name.localeCompare(b.business_name)),
    [vendors],
  );
  const featuredVendors = useMemo(
    () => vendors.filter((v) => v.is_top10).sort((a, b) => (a.approved_at ?? "").localeCompare(b.approved_at ?? "")),
    [vendors],
  );
  const top10Events = useMemo(
    () => events.filter((e) => e.category_tier === "top_10").sort((a, b) => a.name.localeCompare(b.name)),
    [events],
  );
  const addableEvents = useMemo(
    () => events.filter((e) => e.category_tier !== "top_10").sort((a, b) => a.name.localeCompare(b.name)),
    [events],
  );

  const boostRows = useMemo(
    () =>
      bookings
        .map((b) => ({
          booking: b,
          vendor: vendorById.get(b.vendor_id),
          tier: b.tier_id ? tierById.get(b.tier_id) : undefined,
          startMs: new Date(b.slot_start).getTime(),
          endMs: new Date(b.slot_end).getTime(),
        }))
        .sort((a, b) => b.startMs - a.startMs),
    [bookings, vendorById, tierById],
  );

  async function grantBoost() {
    if (!grantVendorId) return;
    const tier = tiers.find((t) => t.slug === grantTierSlug);
    if (!tier) {
      setError(`Pricing tier "${grantTierSlug}" not found — run migration 0040 first.`);
      return;
    }
    setError(null);
    setGranting(true);
    try {
      const supabase = createClient();
      const slotCount = grantTierSlug === "vendor-boost" ? 2 : 3;
      const start = nextBucketStart(Date.now());
      const slotStarts = Array.from({ length: slotCount }, (_, i) => start + i * SLOT_MS);

      // Same 5-per-slot cap as a paid purchase - a comp'd boost still
      // counts against the same rotation capacity everyone else shares.
      const { data: existingRows } = await supabase
        .from("vendor_boost_bookings")
        .select("slot_start")
        .gte("slot_start", new Date(start).toISOString())
        .lt("slot_start", new Date(start + slotCount * SLOT_MS).toISOString())
        .returns<{ slot_start: string }[]>();
      const counts = new Map<number, number>();
      for (const ms of slotStarts) counts.set(ms, 0);
      (existingRows ?? []).forEach((row) => {
        const bucket = Math.floor(new Date(row.slot_start).getTime() / SLOT_MS) * SLOT_MS;
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      });
      const full = slotStarts.filter((ms) => (counts.get(ms) ?? 0) >= MAX_PER_SLOT);
      if (full.length > 0) {
        setError("Every rotation slot is full right now — try again in a few minutes.");
        return;
      }

      const rows = slotStarts.map((ms) => ({
        vendor_id: grantVendorId,
        tier_id: tier.id,
        registration_id: null,
        slot_start: new Date(ms).toISOString(),
        slot_end: new Date(ms + SLOT_MS).toISOString(),
      }));
      const { error: insertError } = await supabase.from("vendor_boost_bookings").insert(rows);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      const vendor = vendorById.get(grantVendorId);
      logActivity(supabase, "vendor", grantVendorId, vendor?.business_name ?? grantVendorId, "Admin-granted boost", tier.name);
      await loadData();
      flash(`✓ Granted ${tier.name} to ${vendor?.business_name ?? "vendor"}`);
      setGrantVendorId("");
    } finally {
      setGranting(false);
    }
  }

  async function endBoostNow(booking: VendorBoostBooking) {
    const vendorName = vendorById.get(booking.vendor_id)?.business_name ?? booking.vendor_id;
    if (!window.confirm(`End ${vendorName}'s boost now?`)) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("vendor_boost_bookings")
      .update({ slot_end: new Date().toISOString() })
      .eq("id", booking.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    logActivity(supabase, "vendor", booking.vendor_id, vendorName, "Admin ended boost early");
    await loadData();
    flash(`✓ Ended ${vendorName}'s boost`);
  }

  // lov_entries.category_tier is the same column migration 0015 used to
  // flag an event Top 10 by hand-written SQL (no admin UI existed to set
  // or clear it before now, which is why a testing-flagged event like Art
  // Walk had no way to be un-flagged short of another raw SQL statement).
  async function addEventToTop10() {
    if (!addEventId) return;
    setError(null);
    setAddingEventTop10(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("lov_entries")
        .update({ category_tier: "top_10" })
        .eq("id", addEventId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      const event = events.find((e) => e.id === addEventId);
      logActivity(supabase, "event", addEventId, event?.name ?? addEventId, "Admin added to Top 10");
      await loadData();
      flash(`✓ Added ${event?.name ?? "event"} to Top 10`);
      setAddEventId("");
    } finally {
      setAddingEventTop10(false);
    }
  }

  async function removeEventFromTop10(event: LovEntry) {
    if (!window.confirm(`Remove ${event.name} from Top 10? It stays live on the Board/Map, just no longer Featured.`)) return;
    setError(null);
    setRemovingEventId(event.id);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("lov_entries")
        .update({ category_tier: "standard" })
        .eq("id", event.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      logActivity(supabase, "event", event.id, event.name, "Admin removed from Top 10");
      await loadData();
      flash(`✓ Removed ${event.name} from Top 10`);
    } finally {
      setRemovingEventId(null);
    }
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">📊 Placements</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Every paid boost/placement and the permanent Featured vendors, in one view. This page only manages{" "}
        <strong>paid boosts</strong> — Founder Vendor and Top 10/Featured status are toggled on{" "}
        <Link href="/admin/vendors" className="underline">
          Vendor Approvals
        </Link>{" "}
        instead, kept deliberately separate so the two never get confused.
      </p>

      {/* PAID BOOST CONTROLS - Quick Boost / Top 10 Placement only. */}
      <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">🚀 Active &amp; Upcoming Boosts</h2>
        <p className="mt-1 text-xs text-slate-600">Quick Boost ($15) and Top 10 Placement ($30) bookings — max {MAX_PER_SLOT} vendors per 10-minute slot.</p>

        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Grant a boost (comp, no payment)</label>
            <select
              value={grantVendorId}
              onChange={(e) => setGrantVendorId(e.target.value)}
              className="mt-1 w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Select vendor…</option>
              {activeVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </div>
          <select
            value={grantTierSlug}
            onChange={(e) => setGrantTierSlug(e.target.value as "vendor-boost" | "top10-30min")}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="vendor-boost">Quick Boost (20 min)</option>
            <option value="top10-30min">Top 10 Placement (30 min)</option>
          </select>
          <button
            type="button"
            onClick={grantBoost}
            disabled={!grantVendorId || granting}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {granting ? "Granting…" : "Grant Now"}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {toast && <p role="status" aria-live="polite" className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{toast}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-amber-200 text-xs font-semibold uppercase text-slate-500">
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Starts</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {boostRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    No boosts yet.
                  </td>
                </tr>
              ) : (
                boostRows.map(({ booking, vendor, tier, startMs, endMs }) => {
                  const isActive = startMs <= now && now < endMs;
                  const isUpcoming = startMs > now;
                  const isExpired = endMs <= now;
                  return (
                    <tr key={booking.id} className="border-b border-amber-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">{vendor?.business_name ?? booking.vendor_id}</td>
                      <td className="py-2 pr-3">{tier?.name ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-500">{new Date(booking.slot_start).toLocaleString("en-US")}</td>
                      <td className="py-2 pr-3">
                        {isActive && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                            🟢 Active — {formatCountdown(endMs - now)} left
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">⏰ Upcoming</span>
                        )}
                        {isExpired && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Inactive</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {!isExpired && (
                          <button
                            type="button"
                            onClick={() => endBoostNow(booking)}
                            className="rounded-full border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            End Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* EVENT TOP 10 - lov_entries.category_tier='top_10', permanent (not
          slot-based like Boosts above). Previously only settable/clearable
          by hand-written SQL - this is the first admin UI for it. */}
      <section className="mt-8 rounded-2xl border border-purple-300 bg-purple-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">🌟 Event Top 10 ({top10Events.length})</h2>
        <p className="mt-1 text-xs text-slate-600">
          Permanent Featured placement for an event/flyer on the public Top 10 strip — separate from vendor Featured
          status above, and separate from the temporary vendor Boosts above that too. Removing an event here only
          clears its Top 10 placement; the event/flyer itself stays live everywhere else.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-purple-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Add an event to Top 10</label>
            <select
              value={addEventId}
              onChange={(e) => setAddEventId(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Select event…</option>
              {addableEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addEventToTop10}
            disabled={!addEventId || addingEventTop10}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {addingEventTop10 ? "Adding…" : "Add to Top 10"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-purple-200 text-xs font-semibold uppercase text-slate-500">
                <th className="py-2 pr-3">Event</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {top10Events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-500">
                    No events in Top 10 right now.
                  </td>
                </tr>
              ) : (
                top10Events.map((e) => (
                  <tr key={e.id} className="border-b border-purple-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">{e.name}</td>
                    <td className="py-2 pr-3 text-slate-500">{e.event_date ? new Date(e.event_date + "T00:00").toLocaleDateString("en-US") : e.recurrence ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => removeEventFromTop10(e)}
                        disabled={removingEventId === e.id}
                        className="rounded-full border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {removingEventId === e.id ? "Removing…" : "Remove from Top 10"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* READ-ONLY - Founder/Featured status is only ever changed on Vendor Approvals. */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">🏆 Top 10 Featured Vendors ({featuredVendors.length}/5)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Read-only here. Change who&apos;s Featured/Founding on{" "}
          <Link href="/admin/vendors" className="underline">
            Vendor Approvals
          </Link>
          .
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Founding</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {featuredVendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No Featured vendors yet.
                  </td>
                </tr>
              ) : (
                featuredVendors.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">{v.business_name}</td>
                    <td className="py-2 pr-3">{v.is_founding_vendor ? "🏆 Yes" : "—"}</td>
                    <td className="py-2 pr-3 capitalize">{v.status}</td>
                    <td className="py-2 pr-3 text-slate-500">{v.approved_at ? new Date(v.approved_at).toLocaleDateString("en-US") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs font-semibold text-amber-700">
          {5 - featuredVendors.length > 0 ? `${5 - featuredVendors.length} Featured spot(s) still open.` : "All 5 Featured spots are filled."}
        </p>
      </section>
    </div>
  );
}
