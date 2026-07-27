"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryTier, LovEntry, Vendor } from "@/lib/types";
import { calculateProximity, formatDistance, getAnchor, setAnchor, type Anchor } from "@/lib/geo";
import { FlyerPlaceholder } from "@/components/flyer-placeholder";

type Pill = "all" | "events" | "bars" | "food" | "vendors";

const PILLS: { id: Pill; label: string }[] = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "bars", label: "Bars & Drinks" },
  { id: "food", label: "Food / Bites" },
  { id: "vendors", label: "Vendors" },
];

interface Item {
  id: string;
  name: string;
  pill: Pill;
  tier: CategoryTier;
  image: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  href: string | null;
  menuUrl: string | null;
  happyHour: string | null;
}

function pillForVendor(v: Vendor): Pill {
  if (v.entity_type === "bar") return "bars";
  if (v.entity_type === "restaurant") return "food";
  return "vendors";
}

export function Top10Directory() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [pill, setPill] = useState<Pill>("all");
  const [anchor, setAnchorState] = useState<Anchor | null>(null);
  const [locating, setLocating] = useState(false);

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
      .eq("type", "event")
      .returns<LovEntry[]>()
      .then(({ data }) => setEvents(data ?? []));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists post-hydration
    setAnchorState(getAnchor());
  }, []);

  function findNearMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
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
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const items = useMemo<Item[]>(() => {
    const fromVendors: Item[] = vendors.map((v) => ({
      id: `vendor-${v.id}`,
      name: v.business_name,
      pill: pillForVendor(v),
      tier: v.category_tier,
      image: v.logo_url,
      description: v.short_description,
      lat: v.lat,
      lng: v.lng,
      href: `/vendor?slug=${encodeURIComponent(v.slug)}`,
      menuUrl: v.menu_url,
      happyHour: v.happy_hour_specials,
    }));
    const fromEvents: Item[] = events.map((e) => ({
      id: `event-${e.id}`,
      name: e.name,
      pill: "events",
      tier: e.category_tier,
      image: e.flyer_image_url,
      description: e.location,
      lat: e.lat,
      lng: e.lng,
      href: null,
      menuUrl: null,
      happyHour: null,
    }));
    return [...fromVendors, ...fromEvents];
  }, [vendors, events]);

  const filtered = pill === "all" ? items : items.filter((i) => i.pill === pill);
  const sorted = anchor ? calculateProximity(filtered, anchor) : filtered.map((i) => ({ ...i, distance: null as number | null }));
  const top10 = sorted.filter((i) => i.tier === "top_10");
  const rest = sorted.filter((i) => i.tier !== "top_10");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Directory</h1>
        <button
          type="button"
          onClick={findNearMe}
          disabled={locating}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? "Locating…" : anchor ? `📍 Sorted Near ${anchor.label}` : "📍 Sort Near Me"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPill(p.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              pill === p.id ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {top10.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-amber-600">🏆 Top 10</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {top10.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {top10.length > 0 && <h2 className="text-lg font-bold text-slate-900">Everything Else</h2>}
        {rest.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nothing in this category yet.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item & { distance?: number | null } }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <FlyerPlaceholder seed={item.name} className="h-full w-full" />
          )}
        </div>
        <div>
          <p className="font-bold text-slate-900">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            {item.tier === "top_10" && <span className="text-xs font-semibold text-amber-600">🏆 Top 10</span>}
            {item.tier === "featured" && <span className="text-xs font-semibold text-indigo-600">⭐ Featured</span>}
            {item.distance != null && (
              <span className="text-xs font-medium text-slate-500">{formatDistance(item.distance)}</span>
            )}
          </div>
        </div>
      </div>
      {item.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
      {item.happyHour && <p className="mt-1 text-xs font-medium text-amber-700">🍹 {item.happyHour}</p>}
      {item.menuUrl && (
        <a
          href={item.menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-block text-xs font-semibold text-slate-900 underline"
        >
          📋 Menu
        </a>
      )}
    </>
  );
  const className = "flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md";
  if (item.href) {
    return (
      <a href={item.href} className={className}>
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}
