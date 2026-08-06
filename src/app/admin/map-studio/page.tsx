"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { MapStudio } from "@/components/map-studio";

type PinRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  status: string;
  lat: number;
  lng: number;
  vendor_id: string | null;
  event_id: string | null;
};

type RawVendorRow = {
  id: string;
  business_name: string;
  lat: number | null;
  lng: number | null;
  status: string;
  location_verified_at: string | null;
  vendor_categories: { categories: { name: string } | null }[] | null;
};

export type VendorPinRow = {
  id: string;
  business_name: string;
  lat: number;
  lng: number;
  status: string;
  category_names: string[];
  location_verified_at: string | null;
};

type RawEventRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  location: string | null;
  location_verified_at: string | null;
  categories: { name: string } | null;
};

export type EventPinRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location: string | null;
  category_name: string | null;
  location_verified_at: string | null;
};

export default function AdminMapStudioPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [pins, setPins] = useState<PinRow[]>([]);
  const [vendors, setVendors] = useState<VendorPinRow[]>([]);
  const [events, setEvents] = useState<EventPinRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data: pinRows }, { data: vendorRows }, { data: eventRows }] = await Promise.all([
        supabase.from("pins").select("*").returns<PinRow[]>(),
        supabase
          .from("vendors")
          .select("id,business_name,lat,lng,status,location_verified_at,vendor_categories(categories(name))")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .returns<RawVendorRow[]>(),
        supabase
          .from("lov_entries")
          .select("id,name,lat,lng,location,location_verified_at,categories(name)")
          .eq("type", "event")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .returns<RawEventRow[]>(),
      ]);
      if (cancelled) return;
      setPins(pinRows ?? []);
      setVendors(
        (vendorRows ?? [])
          .filter((v): v is RawVendorRow & { lat: number; lng: number } => v.lat != null && v.lng != null)
          .map((v) => ({
            id: v.id,
            business_name: v.business_name,
            lat: v.lat,
            lng: v.lng,
            status: v.status,
            category_names: (v.vendor_categories ?? []).map((vc) => vc.categories?.name).filter((n): n is string => !!n),
            location_verified_at: v.location_verified_at,
          })),
      );
      setEvents(
        (eventRows ?? [])
          .filter((e): e is RawEventRow & { lat: number; lng: number } => e.lat != null && e.lng != null)
          .map((e) => ({
            id: e.id,
            name: e.name,
            lat: e.lat,
            lng: e.lng,
            location: e.location,
            category_name: e.categories?.name ?? null,
            location_verified_at: e.location_verified_at,
          })),
      );
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Map Studio</h1>
      <p className="mt-1 text-sm text-slate-600">
        The single place to maintain every real-world location in CityPinned. Toggle Pins, Vendors, and Events on or
        off independently; drag a marker to correct it, then Save. A red ring means a location has never been
        visually checked — Save or Mark as Verified clears it.
      </p>
      <div className="mt-6">
        <MapStudio initialPins={pins} initialVendors={vendors} initialEvents={events} />
      </div>
    </div>
  );
}
