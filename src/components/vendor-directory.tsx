"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LovEntry, Vendor } from "@/lib/types";
import { formatDistance, haversineDistanceMiles } from "@/lib/geo";

interface DirectoryItem {
  id: string;
  kind: "account" | "guest";
  name: string;
  logoUrl: string | null;
  description: string | null;
  instagram: string | null;
  isTop10: boolean;
  lat: number | null;
  lng: number | null;
  href: string | null;
}

function fromVendor(vendor: Vendor): DirectoryItem {
  return {
    id: vendor.id,
    kind: "account",
    name: vendor.business_name,
    logoUrl: vendor.logo_url,
    description: vendor.short_description,
    instagram: vendor.instagram_handle,
    isTop10: vendor.is_top10,
    lat: vendor.lat,
    lng: vendor.lng,
    href: `/vendor/${vendor.slug}`,
  };
}

function fromLovEntry(entry: LovEntry): DirectoryItem {
  return {
    id: entry.id,
    kind: "guest",
    name: entry.name,
    logoUrl: null,
    description: entry.location,
    instagram: entry.instagram_handle,
    isTop10: entry.booth_tier === "top",
    lat: entry.lat,
    lng: entry.lng,
    href: null,
  };
}

export function VendorDirectory({
  vendors,
  guestListings,
}: {
  vendors: Vendor[];
  guestListings: LovEntry[];
}) {
  const items = useMemo(
    () => [...vendors.map(fromVendor), ...guestListings.map(fromLovEntry)],
    [vendors, guestListings],
  );

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function findNearMe() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Couldn't get your location — check location permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const sortedItems = useMemo(() => {
    const withDistance = items.map((item) => ({
      ...item,
      distance:
        userLocation && item.lat !== null && item.lng !== null
          ? haversineDistanceMiles(userLocation.lat, userLocation.lng, item.lat, item.lng)
          : null,
    }));

    if (!userLocation) {
      return withDistance.sort(
        (a, b) => Number(b.isTop10) - Number(a.isTop10) || a.name.localeCompare(b.name),
      );
    }

    return withDistance.sort((a, b) => {
      if (a.distance === null && b.distance === null) return a.name.localeCompare(b.name);
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }, [items, userLocation]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Vendor Directory</h1>
          <p className="mt-2 text-sm text-slate-600">
            Every CityPinned vendor in one place. Works on any device, map or no map.
          </p>
        </div>
        <button
          type="button"
          onClick={findNearMe}
          disabled={locating}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? "Locating…" : userLocation ? "📍 Sorted Near You" : "📍 Sort Near Me"}
        </button>
      </div>
      {locationError && <p className="mt-2 text-sm font-medium text-red-600">{locationError}</p>}

      {!sortedItems.length ? (
        <p className="mt-10 text-sm text-slate-500">
          No vendors yet — be the first to{" "}
          <Link href="/#pricing" className="font-semibold text-slate-900 underline">
            claim a Founding Vendor spot
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((entry) => {
            const { distance } = entry;
            const cardBody = (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    {entry.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">🏪</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{entry.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.isTop10 && (
                        <span className="text-xs font-semibold text-amber-600">🏆 Top 10</span>
                      )}
                      {entry.kind === "guest" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                          Guest Listing
                        </span>
                      )}
                      {distance !== null && (
                        <span className="text-xs font-medium text-slate-500">
                          {formatDistance(distance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {entry.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{entry.description}</p>
                )}
              </>
            );
            const cardClassName =
              "flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md";
            return entry.href ? (
              <Link key={entry.id} href={entry.href} className={cardClassName}>
                {cardBody}
              </Link>
            ) : (
              <div key={entry.id} className={cardClassName}>
                {cardBody}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
