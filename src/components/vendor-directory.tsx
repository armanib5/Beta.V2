"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, LovEntry, Vendor } from "@/lib/types";
import { calculateProximity, formatDistance, getAnchor, setAnchor, type Anchor } from "@/lib/geo";
import { FlyerPlaceholder } from "@/components/flyer-placeholder";
import { BASE_PATH } from "@/lib/site";

interface DirectoryItem {
  id: string;
  kind: "account" | "guest";
  name: string;
  logoUrl: string | null;
  categoryId: string | null;
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
    categoryId: null,
    description: vendor.short_description,
    instagram: vendor.instagram_handle,
    isTop10: vendor.is_top10,
    lat: vendor.lat,
    lng: vendor.lng,
    href: `/vendor?slug=${encodeURIComponent(vendor.slug)}`,
  };
}

function fromLovEntry(entry: LovEntry): DirectoryItem {
  return {
    id: entry.id,
    kind: "guest",
    name: entry.name,
    logoUrl: null,
    categoryId: entry.category_id,
    description: entry.location,
    instagram: entry.instagram_handle,
    isTop10: entry.booth_tier === "top",
    lat: entry.lat,
    lng: entry.lng,
    href: null,
  };
}

export function VendorDirectory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [guestListings, setGuestListings] = useState<LovEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("vendors")
      .select("*")
      .eq("status", "active")
      .returns<Vendor[]>()
      .then(({ data }) => setVendors(data ?? []));
    supabase
      .from("lov_entries")
      .select("*")
      .eq("type", "vendor")
      .eq("status", "active")
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .returns<LovEntry[]>()
      .then(({ data }) => setGuestListings(data ?? []));
    supabase
      .from("categories")
      .select("*")
      .returns<Category[]>()
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const items = useMemo(
    () => [...vendors.map(fromVendor), ...guestListings.map(fromLovEntry)],
    [vendors, guestListings],
  );

  // Same shared anchor the Map and Board read/write (localStorage, same
  // origin) — a city picked on the Map is already the anchor here on load,
  // and picking "Sort Near Me" here carries over to them too.
  const [anchor, setAnchorState] = useState<Anchor | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Reads localStorage, so it can only run post-hydration (the static
    // export's server-rendered HTML always starts anchor-less) — an
    // intentional second render, not one the lint rule's "avoid setState
    // in an effect" guidance is meant to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorState(getAnchor());
  }, []);

  function findNearMe() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: Anchor = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "My Location",
          source: "gps",
        };
        setAnchor(next);
        setAnchorState(next);
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
    if (!anchor) {
      return items
        .map((item) => ({ ...item, distance: null as number | null }))
        .sort((a, b) => Number(b.isTop10) - Number(a.isTop10) || a.name.localeCompare(b.name));
    }
    return calculateProximity(items, anchor);
  }, [items, anchor]);

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
          {locating ? "Locating…" : anchor ? `📍 Sorted Near ${anchor.label}` : "📍 Sort Near Me"}
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
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200">
                    {entry.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <FlyerPlaceholder
                        seed={entry.name}
                        icon={categoryById.get(entry.categoryId ?? "")?.icon ?? "🏪"}
                        className="h-full w-full"
                      />
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
            return (
              <div
                key={entry.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
              >
                {entry.href ? (
                  <Link href={entry.href} className="flex flex-1 flex-col">
                    {cardBody}
                  </Link>
                ) : (
                  cardBody
                )}
                <a
                  href={`${BASE_PATH}/board/?openVendor=${encodeURIComponent(entry.name)}`}
                  className="mt-3 inline-block self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                >
                  🛒 Vendor Hub
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
