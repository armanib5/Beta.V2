"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, LovEntry, Vendor } from "@/lib/types";
import { calculateProximity, formatDistance, getAnchor, setAnchor, type Anchor } from "@/lib/geo";
import { FlyerPlaceholder } from "@/components/flyer-placeholder";
import { BASE_PATH } from "@/lib/site";

type Pill = "all" | "events" | "bars" | "food" | "vendors";

const PILLS: { key: Pill; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "bars", label: "Bars & Drinks" },
  { key: "food", label: "Food / Bites" },
  { key: "vendors", label: "Vendors" },
];

const TOP10_TITLE: Record<Pill, string> = {
  all: "Top 10",
  events: "Featured Events",
  bars: "Top 10 Bars",
  food: "Top 10 Food Spots",
  vendors: "Top 10 Vendors",
};

interface DirectoryItem {
  id: string;
  pill: Exclude<Pill, "all">;
  name: string;
  logoUrl: string | null;
  categoryIcon: string | null;
  description: string | null;
  isTop10: boolean;
  isFeatured: boolean;
  lat: number | null;
  lng: number | null;
  eventDate: string | null;
  href: string | null;
}

function classifyGuestPill(entry: LovEntry, categorySlugById: Map<string, string>): Exclude<Pill, "all" | "events"> {
  const slug = entry.category_id ? categorySlugById.get(entry.category_id) : undefined;
  if (slug === "bar") return "bars";
  if (slug === "restaurant") return "food";
  return "vendors";
}

function fromVendor(vendor: Vendor): DirectoryItem {
  const pill = vendor.entity_type === "bar" ? "bars" : vendor.entity_type === "restaurant" ? "food" : "vendors";
  return {
    id: `vendor:${vendor.id}`,
    pill,
    name: vendor.business_name,
    logoUrl: vendor.logo_url,
    categoryIcon: null,
    description: vendor.short_description,
    isTop10: vendor.is_top10 || vendor.category_tier === "top_10",
    isFeatured: vendor.category_tier === "featured",
    lat: vendor.lat,
    lng: vendor.lng,
    eventDate: null,
    href: `/vendor?slug=${encodeURIComponent(vendor.slug)}`,
  };
}

function fromGuestListing(entry: LovEntry, categorySlugById: Map<string, string>): DirectoryItem {
  return {
    id: `lov:${entry.id}`,
    pill: classifyGuestPill(entry, categorySlugById),
    name: entry.name,
    logoUrl: entry.flyer_image_url,
    categoryIcon: null,
    description: entry.location,
    isTop10: entry.booth_tier === "top" || entry.category_tier === "top_10",
    isFeatured: entry.category_tier === "featured",
    lat: entry.lat,
    lng: entry.lng,
    eventDate: null,
    href: null,
  };
}

function fromEvent(entry: LovEntry, categoryById: Map<string, Category>): DirectoryItem {
  return {
    id: `event:${entry.id}`,
    pill: "events",
    name: entry.name,
    logoUrl: entry.flyer_image_url,
    categoryIcon: categoryById.get(entry.category_id ?? "")?.icon ?? "📅",
    description: entry.location,
    isTop10: entry.category_tier === "top_10",
    isFeatured: entry.category_tier === "featured",
    lat: entry.lat,
    lng: entry.lng,
    eventDate: entry.event_date,
    href: null,
  };
}

export function Top10Directory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [guestListings, setGuestListings] = useState<LovEntry[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pill, setPill] = useState<Pill>("all");

  useEffect(() => {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
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
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .returns<LovEntry[]>()
      .then(({ data }) => setGuestListings(data ?? []));
    supabase
      .from("lov_entries")
      .select("*")
      .eq("type", "event")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .returns<LovEntry[]>()
      .then(({ data }) => setEvents(data ?? []));
    supabase
      .from("categories")
      .select("*")
      .returns<Category[]>()
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categorySlugById = useMemo(() => new Map(categories.map((c) => [c.id, c.slug])), [categories]);

  const allItems = useMemo(
    () => [
      ...vendors.map(fromVendor),
      ...guestListings.map((e) => fromGuestListing(e, categorySlugById)),
      ...events.map((e) => fromEvent(e, categoryById)),
    ],
    [vendors, guestListings, events, categorySlugById, categoryById],
  );

  const [anchor, setAnchorState] = useState<Anchor | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Reads localStorage post-hydration, same shared anchor as Map/Board/Vendor Directory.
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

  const filtered = useMemo(
    () => (pill === "all" ? allItems : allItems.filter((item) => item.pill === pill)),
    [allItems, pill],
  );

  const top10 = useMemo(() => filtered.filter((item) => item.isTop10), [filtered]);

  const nearMe = useMemo(() => {
    const rest = filtered.filter((item) => !item.isTop10);
    if (!anchor) {
      return rest
        .map((item) => ({ ...item, distance: null as number | null }))
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name));
    }
    return calculateProximity(rest, anchor);
  }, [filtered, anchor]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Directory</h1>
          <p className="mt-2 text-sm text-slate-600">Events, vendors, restaurants, and bars — all in one place.</p>
        </div>
        <button
          type="button"
          onClick={findNearMe}
          disabled={locating}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? "Locating…" : anchor ? `📍 Sorted Near ${anchor.label}` : "📍 Near Me"}
        </button>
      </div>
      {locationError && <p className="mt-2 text-sm font-medium text-red-600">{locationError}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {PILLS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPill(p.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pill === p.key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {top10.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            🏆 {TOP10_TITLE[pill]}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {top10.map((item) => (
              <DirectoryCard key={item.id} item={item} gold />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">{anchor ? "Near Me" : "All"}</h2>
        {nearMe.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearMe.map((item) => (
              <DirectoryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DirectoryCard({
  item,
  gold,
}: {
  item: DirectoryItem & { distance?: number | null };
  gold?: boolean;
}) {
  const cardBody = (
    <>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200">
          {item.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FlyerPlaceholder seed={item.name} icon={item.categoryIcon ?? "🏪"} className="h-full w-full" />
          )}
        </div>
        <div>
          <p className="font-bold text-slate-900">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {item.isTop10 && <span className="text-xs font-semibold text-amber-600">🏆 Top 10</span>}
            {!item.isTop10 && item.isFeatured && (
              <span className="text-xs font-semibold text-sky-600">⭐ Featured</span>
            )}
            {item.eventDate && (
              <span className="text-xs font-medium text-slate-500">
                {new Date(item.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            {item.distance != null && (
              <span className="text-xs font-medium text-slate-500">{formatDistance(item.distance)}</span>
            )}
          </div>
        </div>
      </div>
      {item.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
    </>
  );

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md ${
        gold ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
      }`}
    >
      {item.href ? (
        <Link href={item.href} className="flex flex-1 flex-col">
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}
      <a
        href={`${BASE_PATH}/board/?openVendor=${encodeURIComponent(item.name)}`}
        className="mt-3 inline-block self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
      >
        {item.pill === "events" ? "📌 View on Board" : "🛒 Vendor Hub"}
      </a>
    </div>
  );
}
