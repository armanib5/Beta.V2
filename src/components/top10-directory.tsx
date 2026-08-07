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

// The Board and Map both check section_zone (an admin-settable manual
// city/section override) before falling back to raw lat/lng - this used
// to always skip straight to nearestCityCenter(lat, lng), so a row an
// admin corrected via section_zone (e.g. a boundary-adjacent address)
// could show under the right city on Board/Map but the wrong one here,
// for the exact same row. Mirrors that same precedence now.
function cityInfo(lat: number | null, lng: number | null, sectionZone?: string | null): { city: string; section: string | null } {
  if (sectionZone) {
    const bySection = CITY_CENTERS.find((c) => c.section === sectionZone);
    if (bySection) return { city: bySection.city, section: bySection.section };
  }
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
    ...cityInfo(entry.lat, entry.lng, entry.section_zone),
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
    ...cityInfo(entry.lat, entry.lng, entry.section_zone),
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
      .eq("status", "active")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .returns<LovEntry[]>()
      .then(({ data }) => setGuestListings(data ?? []));
    supabase
      .from("lov_entries")
      .select("*")
      .eq("type", "event")
      .eq("status", "active")
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

  // Deliberately NOT dependent on activeBoostEndByVendor/now - that used
  // to bake live boost status into every item here, which meant this
  // (and everything derived from it: filtered, featured, the whole main
  // grid) recomputed from scratch every second for every visitor, even
  // though boost status only actually matters for the small "Rotating
  // Boost" strip below (boostedNow), which reads activeBoostEndByVendor
  // directly instead now.
  const allItems = useMemo(() => {
    // A guest listing linked to a real vendor account (lov_entries.vendor_id)
    // would otherwise render twice - once from `vendors`, once from here.
    const linkedVendorIds = new Set(vendors.map((v) => v.id));
    const unlinkedGuestListings = guestListings.filter((e) => !e.vendor_id || !linkedVendorIds.has(e.vendor_id));
    return [
      ...vendors.map(fromVendor),
      ...unlinkedGuestListings.map((e) => fromGuestListing(e, categorySlugById)),
      ...events.map((e) => fromEvent(e, categoryById)),
    ];
  }, [vendors, guestListings, events, categorySlugById, categoryById]);

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

  // Top 10 = 5 permanent Featured slots (paid $50/$100 tiers, capped by
  // pricing_tiers.max_slots server-side) + 5 rotating Boost slots (paid
  // $15/$30 slot bookings, capped by the 5-per-10-minute-window booking
  // limit) - sliced to 5 here too as a display-side backstop in case
  // either cap is ever bypassed (e.g. an admin manually flipping is_top10).
  const featured = useMemo(() => filtered.filter((item) => item.isTop10).slice(0, 5), [filtered]);

  const boostedNow = useMemo(() => {
    const boosted: DirectoryItem[] = [];
    for (const item of filtered) {
      if (!item.id.startsWith("vendor:")) continue;
      const end = activeBoostEndByVendor.get(item.id.slice("vendor:".length));
      if (end) boosted.push({ ...item, boostActiveUntil: end });
    }
    return boosted.sort((a, b) => new Date(a.boostActiveUntil!).getTime() - new Date(b.boostActiveUntil!).getTime()).slice(0, 5);
  }, [filtered, activeBoostEndByVendor]);

  // A stable string, not the boostedNow array itself, as nearMe's
  // dependency - activeBoostEndByVendor (and so boostedNow) gets a new
  // object identity every second from the live countdown tick, even
  // when the actual SET of currently-boosted vendors hasn't changed.
  // Depending on boostedNow directly used to recompute (and re-render)
  // the entire main grid every second along with it; this key only
  // actually changes value when boosted membership itself changes.
  const boostedVendorIdsKey = [...activeBoostEndByVendor.keys()].sort().join(",");

  const nearMe = useMemo(() => {
    const boostedIds = new Set(boostedVendorIdsKey ? boostedVendorIdsKey.split(",") : []);
    const rest = filtered.filter((item) => !item.isTop10 && !(item.id.startsWith("vendor:") && boostedIds.has(item.id.slice("vendor:".length))));
    if (!anchor) {
      return rest
        .map((item) => ({ ...item, distance: null as number | null }))
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name));
    }
    return calculateProximity(rest, anchor);
  }, [filtered, anchor, boostedVendorIdsKey]);

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
      {locationError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{locationError}</p>}

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

      {(featured.length > 0 || boostedNow.length > 0) && (
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">🏆 {TOP10_TITLE[pill]}</h2>
          <p className="mt-1 text-xs text-slate-600">
            5 permanent Featured spots + 5 rotating Boost spots — always up to 10 total.
          </p>

          <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-700">
            Featured ({featured.length}/5)
          </h3>
          {featured.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No Featured vendors yet.</p>
          ) : (
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((item) => (
                <DirectoryCard key={item.id} item={item} gold />
              ))}
            </div>
          )}

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-700">
            Rotating Boost ({boostedNow.length}/5)
          </h3>
          {boostedNow.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No active boosts right now.</p>
          ) : (
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boostedNow.map((item) => (
                <DirectoryCard key={item.id} item={item} gold now={now} />
              ))}
            </div>
          )}
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
  const [logoFailed, setLogoFailed] = useState(false);
  const cardBody = (
    <>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200">
          {item.logoUrl && !logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logoUrl} alt="" className="h-full w-full object-cover" onError={() => setLogoFailed(true)} />
          ) : (
            <FlyerPlaceholder seed={item.name} icon={item.categoryIcon ?? "🏪"} className="h-full w-full" />
          )}
        </div>
        <div>
          <p className="font-bold text-slate-900">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {boostRemainingMs > 0 && (
              <span
                className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900"
                title="Paid boost placement"
              >
                🚀 PAID BOOST — {formatCountdown(boostRemainingMs)} left
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
          href={
            item.pill === "events"
              ? `${BASE_PATH}/board/?flyerId=${encodeURIComponent(item.id.replace(/^event:/, ""))}`
              : `${BASE_PATH}/board/?openVendor=${encodeURIComponent(item.name)}`
          }
          className="mt-3 inline-block self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
        >
          {item.pill === "events" ? "📌 View on Board" : "🛒 Vendor Hub"}
        </a>
      )}
    </div>
  );
}
