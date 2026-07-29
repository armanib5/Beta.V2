"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, LovEntry, Vendor, VendorBoostBooking } from "@/lib/types";
import { CITIES, CITY_CENTERS, calculateProximity, formatDistance, getAnchor, nearestCityCenter, setAnchor, type Anchor } from "@/lib/geo";
import { FlyerPlaceholder } from "@/components/flyer-placeholder";
import { BASE_PATH } from "@/lib/site";

type Pill = "all" | "events" | "bars" | "food" | "vendors";

const PILLS: { key: Pill; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "bars", label: "Bars & Drinks" },
  { key: "food", label: "Food / Bites" },
  { key: "vendors", label: "Pop-Up Vendors" },
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
  boostActiveUntil: string | null;
  lat: number | null;
  lng: number | null;
  eventDate: string | null;
  href: string | null;
  city: string;
  section: string | null;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function cityInfo(lat: number | null, lng: number | null): { city: string; section: string | null } {
  if (lat == null || lng == null) return { city: "Unknown", section: null };
  const nearest = nearestCityCenter(lat, lng);
  return { city: nearest.city, section: nearest.section };
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
    // Overlaid from vendor_boost_bookings in the allItems memo below - a
    // slot-scheduled boost isn't known at the vendor row level anymore.
    boostActiveUntil: null,
    lat: vendor.lat,
    lng: vendor.lng,
    eventDate: null,
    href: `/vendor?slug=${encodeURIComponent(vendor.slug)}`,
    ...cityInfo(vendor.lat, vendor.lng),
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
    boostActiveUntil: null,
    lat: entry.lat,
    lng: entry.lng,
    eventDate: null,
    href: null,
    ...cityInfo(entry.lat, entry.lng),
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
    boostActiveUntil: null,
    lat: entry.lat,
    lng: entry.lng,
    eventDate: entry.event_date,
    href: null,
    ...cityInfo(entry.lat, entry.lng),
  };
}

export function Top10Directory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [guestListings, setGuestListings] = useState<LovEntry[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pill, setPill] = useState<Pill>("all");
  const [cityFilter, setCityFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [boostBookings, setBoostBookings] = useState<VendorBoostBooking[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    supabase
      .from("vendors")
      .select("*")
      .eq("status", "active")
      .eq("is_internal", false)
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
    // Covers both a booking active right now and one scheduled for later
    // today - only "currently active" ones (slot_start <= now < slot_end)
    // actually render as boosted, computed below with the live `now` tick.
    supabase
      .from("vendor_boost_bookings")
      .select("*")
      .gte("slot_end", nowIso)
      .returns<VendorBoostBooking[]>()
      .then(({ data }) => setBoostBookings(data ?? []));
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categorySlugById = useMemo(() => new Map(categories.map((c) => [c.id, c.slug])), [categories]);

  const activeBoostEndByVendor = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of boostBookings) {
      const start = new Date(b.slot_start).getTime();
      const end = new Date(b.slot_end).getTime();
      if (start <= now && now < end) {
        const existing = map.get(b.vendor_id);
        if (!existing || new Date(existing).getTime() < end) map.set(b.vendor_id, b.slot_end);
      }
    }
    return map;
  }, [boostBookings, now]);

  const allItems = useMemo(() => {
    const items = [
      ...vendors.map(fromVendor),
      ...guestListings.map((e) => fromGuestListing(e, categorySlugById)),
      ...events.map((e) => fromEvent(e, categoryById)),
    ];
    return items.map((item) => {
      if (!item.id.startsWith("vendor:")) return item;
      const activeEnd = activeBoostEndByVendor.get(item.id.slice("vendor:".length));
      return activeEnd ? { ...item, boostActiveUntil: activeEnd } : item;
    });
  }, [vendors, guestListings, events, categorySlugById, categoryById, activeBoostEndByVendor]);

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

  const cities = useMemo(() => ["All", ...CITIES], []);
  const sections = useMemo(() => {
    if (cityFilter === "All") return ["All"];
    return ["All", ...CITY_CENTERS.filter((c) => c.city === cityFilter).map((c) => c.section ?? c.label)];
  }, [cityFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (pill !== "all" && item.pill !== pill) return false;
      if (cityFilter !== "All" && item.city !== cityFilter) return false;
      if (sectionFilter !== "All" && item.section !== sectionFilter) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, pill, cityFilter, sectionFilter, search]);

  const top10 = useMemo(() => filtered.filter((item) => item.isTop10), [filtered]);

  const boostedNow = useMemo(
    () =>
      filtered
        .filter((item) => item.boostActiveUntil && new Date(item.boostActiveUntil).getTime() > now)
        .sort((a, b) => new Date(a.boostActiveUntil!).getTime() - new Date(b.boostActiveUntil!).getTime()),
    [filtered, now],
  );

  const nearMe = useMemo(() => {
    const rest = filtered.filter((item) => !item.isTop10 && !boostedNow.includes(item));
    if (!anchor) {
      return rest
        .map((item) => ({ ...item, distance: null as number | null }))
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name));
    }
    return calculateProximity(rest, anchor);
  }, [filtered, anchor, boostedNow]);

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setSectionFilter("All");
          }}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All Cities" : c}
            </option>
          ))}
        </select>
        {sections.length > 1 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Neighborhoods" : s}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
        />
      </div>

      {boostedNow.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">⭐ Boosted Now</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boostedNow.map((item) => (
              <DirectoryCard key={item.id} item={item} gold now={now} />
            ))}
          </div>
        </section>
      )}

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
  now,
}: {
  item: DirectoryItem & { distance?: number | null };
  gold?: boolean;
  now?: number;
}) {
  const boostRemainingMs = item.boostActiveUntil && now ? new Date(item.boostActiveUntil).getTime() - now : 0;
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
            {boostRemainingMs > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">
                🔥 BOOSTED ({formatCountdown(boostRemainingMs)} left)
              </span>
            )}
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
      {(item.pill === "bars" || item.pill === "food") && item.href ? (
        <Link
          href={item.href}
          className="mt-3 inline-block self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
        >
          🍽️ Menu Hub
        </Link>
      ) : (
        <a
          href={`${BASE_PATH}/board/?openVendor=${encodeURIComponent(item.name)}`}
          className="mt-3 inline-block self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
        >
          {item.pill === "events" ? "📌 View on Board" : "🛒 Vendor Hub"}
        </a>
      )}
    </div>
  );
}
