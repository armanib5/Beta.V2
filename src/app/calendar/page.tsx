"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Category, LovEntry } from "@/lib/types";
import { EventCalendar } from "@/components/event-calendar";
import { CITIES, CITY_CENTERS, getAnchor, haversineDistanceMiles, nearestCityCenter } from "@/lib/geo";

function cityForEvent(event: LovEntry): string {
  if (event.section_zone) {
    const bySection = CITY_CENTERS.find((c) => c.section === event.section_zone);
    if (bySection) return bySection.city;
  }
  if (event.lat !== null && event.lng !== null) {
    return nearestCityCenter(event.lat, event.lng).city;
  }
  return "San Jose";
}

export default function CalendarPage() {
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [city, setCity] = useState<string>("All");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("lov_entries")
      .select("*")
      .eq("type", "event")
      .eq("status", "active")
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order("event_date")
      .returns<LovEntry[]>()
      .then(({ data }) => setEvents(data ?? []));
    supabase
      .from("categories")
      .select("*")
      .returns<Category[]>()
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const cityOptions = useMemo(() => {
    const anchor = getAnchor();
    const list = [...CITIES];
    if (anchor) {
      list.sort((a, b) => {
        const ca = CITY_CENTERS.find((c) => c.city === a);
        const cb = CITY_CENTERS.find((c) => c.city === b);
        if (!ca || !cb) return 0;
        return (
          haversineDistanceMiles(anchor.lat, anchor.lng, ca.lat, ca.lng) -
          haversineDistanceMiles(anchor.lat, anchor.lng, cb.lat, cb.lng)
        );
      });
    }
    return ["All", ...list];
  }, []);

  const filteredEvents = useMemo(
    () => (city === "All" ? events : events.filter((e) => cityForEvent(e) === city)),
    [events, city],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Event Calendar</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tap a day with events to see its flyer and details.
          </p>
          <Link
            href="/vendor/signup?type=venue"
            className="mt-2 inline-block rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            🏛️ Own a venue? Become a Venue Hub →
          </Link>
        </div>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All Cities" : c}
            </option>
          ))}
        </select>
      </div>
      <EventCalendar events={filteredEvents} categories={categories} />
    </div>
  );
}
