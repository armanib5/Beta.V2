"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CITY_CENTERS } from "@/lib/geo";
import type { Booth, LovEntry, Vendor, ZoneBoundary, ZoneFeature } from "@/lib/types";
import { ZoneMap } from "@/components/zone-map";
import { ZoneMapLeaflet } from "@/components/zone-map-leaflet";
import { BackButton } from "@/components/back-button";

/** Same "legacy vs geo" split admin/zones/page.tsx uses - a row is
 * "legacy" only if it has real percentage-grid data and no traced
 * real-world event boundary yet. Keeps this page's behavior byte-for-byte
 * identical for the one event with existing percentage-grid booths
 * (Downtown San Jose Farmers Market). */
function computeDataMode(booths: Booth[], boundaries: ZoneBoundary[]): "legacy" | "geo" {
  const hasLegacyData = booths.some((b) => b.x != null || b.y != null) || boundaries.some((b) => b.points.length > 0);
  const hasGeoEventBoundary = boundaries.some(
    (b) => b.boundary_type === "event_boundary" && b.points_geo && b.points_geo.length >= 3,
  );
  return hasLegacyData && !hasGeoEventBoundary ? "legacy" : "geo";
}

export default function VendorZonesPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [eventId, setEventId] = useState("");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [boundaries, setBoundaries] = useState<ZoneBoundary[]>([]);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingZone, setLoadingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorNameById, setVendorNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        router.replace("/vendor/login");
        return;
      }
      const [{ data: vendorRow }, { data: eventRows }, { data: allVendors }] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", user.id).maybeSingle<Vendor>(),
        supabase
          .from("lov_entries")
          .select("*")
          .eq("type", "event")
          .order("event_date", { ascending: false })
          .returns<LovEntry[]>(),
        supabase.from("vendors").select("id,business_name").eq("status", "active").returns<
          Pick<Vendor, "id" | "business_name">[]
        >(),
      ]);
      if (cancelled) return;
      setVendor(vendorRow ?? null);
      setEvents(eventRows ?? []);
      setEventId(eventRows?.[0]?.id ?? "");
      setVendorNameById(Object.fromEntries((allVendors ?? []).map((v) => [v.id, v.business_name])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale data when the event picker is reset
      setBooths([]);
      setBoundaries([]);
      setFeatures([]);
      return;
    }
    let cancelled = false;
    setLoadingZone(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("booths").select("*").eq("event_id", eventId).order("booth_number").returns<Booth[]>(),
      supabase.from("zone_boundaries").select("*").eq("event_id", eventId).returns<ZoneBoundary[]>(),
      supabase.from("zone_features").select("*").eq("event_id", eventId).returns<ZoneFeature[]>(),
    ]).then(([boothRes, boundaryRes, featureRes]) => {
      if (cancelled) return;
      if (boothRes.error) setError(boothRes.error.message);
      else setBooths(boothRes.data ?? []);
      setBoundaries(boundaryRes.data ?? []);
      setFeatures(featureRes.data ?? []);
      setLoadingZone(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const dataMode = useMemo(() => computeDataMode(booths, boundaries), [booths, boundaries]);
  const geoBoundaries = useMemo(() => boundaries.filter((b) => b.points_geo && b.points_geo.length > 0), [boundaries]);
  const geoBooths = useMemo(() => booths.filter((b) => b.lat != null && b.lng != null), [booths]);
  const mapCenter = useMemo(() => {
    if (selectedEvent?.lat != null && selectedEvent?.lng != null) return { lat: selectedEvent.lat, lng: selectedEvent.lng };
    const anchor = CITY_CENTERS[0];
    return { lat: anchor.lat, lng: anchor.lng };
  }, [selectedEvent]);

  async function claim(booth: Booth) {
    if (!vendor) return;
    setError(null);
    const supabase = createClient();
    const mine = booth.vendor_id === vendor.id;
    const { data, error: updateError } = await supabase
      .from("booths")
      .update(mine ? { vendor_id: null, status: "open" } : { vendor_id: vendor.id, status: "occupied" })
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();
    if (updateError || !data) {
      setError(updateError?.message ?? "That booth was just taken — try another one.");
      return;
    }
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  if (loading) {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (!vendor) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">No vendor profile found</h1>
        <p className="mt-3 text-sm text-slate-600">Finish signing up first to claim a booth.</p>
        <Link href="/vendor/signup" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Vendor Signup
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton className="mb-3" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Claim a Booth</h1>
        <Link href="/vendor/dashboard" className="text-sm font-semibold text-slate-700 underline">
          My Dashboard →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Green booths are open — tap one to claim it. Your own booth is outlined in blue; tap it again to release it.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Event</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          {events.length === 0 && <option value="">No events yet</option>}
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {event.event_date ? ` — ${event.event_date}` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6">
        {loadingZone && <p className="text-sm text-slate-500">Loading zone map…</p>}
        {!loadingZone && eventId && dataMode === "geo" && (
          <ZoneMapLeaflet
            mode="vendor-claim"
            center={mapCenter}
            boundaries={geoBoundaries}
            booths={geoBooths}
            features={features}
            currentVendorId={vendor.id}
            onBoothClick={claim}
          />
        )}
        {!loadingZone && eventId && dataMode === "legacy" && (
          <ZoneMap
            booths={booths}
            boundaries={boundaries}
            mode="vendor"
            currentVendorId={vendor.id}
            onBoothClick={claim}
            vendorNameById={vendorNameById}
          />
        )}
        {!loadingZone && eventId && booths.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No booths have been set up for this event yet.</p>
        )}
      </div>
    </div>
  );
}
