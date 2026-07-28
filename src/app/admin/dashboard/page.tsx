"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import { formatPrice, type LovEntry, type Pin, type PricingTier, type Registration, type Vendor } from "@/lib/types";

function cityForCoords(lat: number | null, lng: number | null, sectionZone?: string | null): string {
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

export default function AdminDashboardPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [city, setCity] = useState("San Jose");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: vendorRows }, { data: eventRows }, { data: pinRows }, { data: regRows }, { data: tierRows }] =
        await Promise.all([
          supabase.from("vendors").select("*").eq("is_internal", false).returns<Vendor[]>(),
          supabase.from("lov_entries").select("*").eq("type", "event").returns<LovEntry[]>(),
          supabase.from("pins").select("*").returns<Pin[]>(),
          supabase.from("registrations").select("*").returns<Registration[]>(),
          supabase.from("pricing_tiers").select("*").returns<PricingTier[]>(),
        ]);
      if (cancelled) return;
      setVendors(vendorRows ?? []);
      setEvents(eventRows ?? []);
      setPins(pinRows ?? []);
      setRegistrations(regRows ?? []);
      setTiers(tierRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cities = useMemo(
    () => [...new Set(CITY_CENTERS.map((c) => c.city))],
    [],
  );

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  const metrics = useMemo(() => {
    const today = todayKey();

    const cityVendors = vendors.filter((v) => cityForCoords(v.lat, v.lng) === city);
    const cityEvents = events.filter((e) => cityForCoords(e.lat, e.lng, e.section_zone) === city);
    const cityPins = pins.filter((p) => cityForCoords(p.lat, p.lng) === city);

    const activeEvents = cityEvents.filter(
      (e) => e.status === "active" && (!e.event_date || e.event_date.slice(0, 10) >= today),
    );
    const upcomingDates = [...new Set(activeEvents.map((e) => e.event_date?.slice(0, 10)).filter(Boolean))]
      .sort()
      .slice(0, 6) as string[];

    const pending = cityVendors.filter((v) => v.status === "pending").length;
    const paid = cityVendors.filter((v) => v.status === "active" && (v.tier_id || v.is_founding_vendor || v.is_top10)).length;
    const free = cityVendors.filter((v) => v.status === "active" && !v.tier_id && !v.is_founding_vendor && !v.is_top10).length;

    const pinsReview = cityPins.filter((p) => p.status === "pending").length;

    const cityVendorIds = new Set(cityVendors.map((v) => v.id));
    const cityRegistrations = registrations.filter(
      (r) => r.status === "paid" && r.claimed_by_vendor_id && cityVendorIds.has(r.claimed_by_vendor_id),
    );
    let featuredCents = 0;
    let boostCents = 0;
    cityRegistrations.forEach((r) => {
      const tier = tierById.get(r.tier_id);
      if (tier?.is_top10) featuredCents += r.amount_cents;
      else boostCents += r.amount_cents;
    });

    return {
      eventsActive: activeEvents.length,
      upcomingDates,
      vendorsTotal: cityVendors.length,
      pending,
      paid,
      free,
      pinsTotal: cityPins.length,
      pinsReview,
      featuredCents,
      boostCents,
    };
  }, [vendors, events, pins, registrations, tierById, city]);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <Link href="/admin" className="text-sm font-semibold text-slate-700 underline">
          ← Admin Home
        </Link>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700">City</label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="ml-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="Events">
          <p className="text-2xl font-bold text-slate-900">{metrics.eventsActive} active</p>
          <Link href="/calendar" className="mt-2 inline-block text-xs font-semibold text-slate-700 underline">
            Calendar View →
          </Link>
        </MetricCard>

        <MetricCard title="Vendors">
          <p className="text-2xl font-bold text-slate-900">{metrics.vendorsTotal} total</p>
          <p className="mt-1 text-xs text-slate-600">
            {metrics.pending} pending · {metrics.paid} paid · {metrics.free} free
          </p>
          <Link href="/admin/vendors" className="mt-2 inline-block text-xs font-semibold text-slate-700 underline">
            Vendor Approvals →
          </Link>
        </MetricCard>

        <MetricCard title="Pins">
          <p className="text-2xl font-bold text-slate-900">{metrics.pinsTotal} locations</p>
          <p className="mt-1 text-xs text-slate-600">{metrics.pinsReview} awaiting review</p>
          <Link href="/admin/pins" className="mt-2 inline-block text-xs font-semibold text-slate-700 underline">
            Pins Manager →
          </Link>
        </MetricCard>

        <MetricCard title="Bookings">
          {metrics.upcomingDates.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming dates yet.</p>
          ) : (
            <p className="text-sm font-semibold text-slate-900">
              {metrics.upcomingDates
                .map((d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
                .join(", ")}
            </p>
          )}
        </MetricCard>

        <MetricCard title="Revenue">
          <p className="text-sm text-slate-900">
            <span className="font-bold">{formatPrice(metrics.featuredCents)}</span> Featured
          </p>
          <p className="mt-1 text-sm text-slate-900">
            <span className="font-bold">{formatPrice(metrics.boostCents)}</span> Boosts
          </p>
        </MetricCard>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        All numbers above are computed live from the database for {city} — not sample data.
      </p>
    </div>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
