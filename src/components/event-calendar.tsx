"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, LovEntry } from "@/lib/types";
import { FlyerPlaceholder } from "@/components/flyer-placeholder";
import { BASE_PATH } from "@/lib/site";
import { expandRecurringEventForMonth } from "@/lib/recurrence";
import { createClient } from "@/lib/supabase/client";

interface EventVendor {
  name: string;
  slug: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Every "YYYY-MM-DD" day from start through end (inclusive), in UTC to avoid local-timezone drift. */
function expandDateRange(start: string, end: string | null): string[] {
  const [sy, sm, sd] = start.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = end
    ? (() => {
        const [ey, em, ed] = end.split("-").map(Number);
        return Date.UTC(ey, em - 1, ed);
      })()
    : startMs;

  const days: string[] = [];
  const maxSpanMs = startMs + 60 * 24 * 60 * 60 * 1000; // cap runaway ranges at ~60 days
  for (let ms = startMs; ms <= Math.min(endMs, maxSpanMs); ms += 24 * 60 * 60 * 1000) {
    const d = new Date(ms);
    days.push(toDateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return days;
}

export function EventCalendar({ events, categories = [] }: { events: LovEntry[]; categories?: Category[] }) {
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Memoized (not just a plain const) so it's a stable dependency for the
  // eventsByDate useMemo below - a plain `new Date()`-derived value has a
  // new identity every render, which the React Compiler can't prove is
  // safe to depend on.
  const todayKey = useMemo(() => toDateKey(today.getFullYear(), today.getMonth(), today.getDate()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, LovEntry[]>();
    for (const event of events) {
      if (event.event_date) {
        for (const key of expandDateRange(event.event_date.slice(0, 10), event.end_date?.slice(0, 10) ?? null)) {
          const list = map.get(key) ?? [];
          list.push(event);
          map.set(key, list);
        }
      } else if (event.recurrence) {
        // Purely recurring rows (no event_date) used to never populate any
        // day cell at all - only the flat "Recurring Markets & Events"
        // list below. This expands them onto every matching weekday in
        // the currently-displayed month, at render time only - no new
        // rows are ever written, so there's nothing to duplicate.
        for (const key of expandRecurringEventForMonth(event.recurrence, cursor.year, cursor.month, todayKey, onCurrentMonth)) {
          const list = map.get(key) ?? [];
          list.push(event);
          map.set(key, list);
        }
      }
    }
    return map;
  }, [events, cursor.year, cursor.month, todayKey, onCurrentMonth]);

  const recurringEvents = useMemo(() => events.filter((event) => !event.event_date), [events]);

  // Reuses the exact same "Top 10" signal top10-directory.tsx's fromEvent()
  // reads (entry.category_tier === "top_10") - not a second Top 10 system,
  // just reading the one existing field this component already has
  // `events` for. 5 above the calendar, 5 below; fewer if fewer exist.
  const top10Events = useMemo(() => events.filter((event) => event.category_tier === "top_10"), [events]);
  const top10Above = top10Events.slice(0, 5);
  const top10Below = top10Events.slice(5, 10);

  // Real per-event vendor roster, from the same booths.vendor_id
  // relationship Event Zone Studio writes (the actual source of truth -
  // see the Vendor Hub fix this same pass made to public/board/js/app.js).
  // One batched fetch for every event shown here, not per-card.
  const [vendorsByEventId, setVendorsByEventId] = useState<Map<string, EventVendor[]>>(new Map());
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("booths")
      .select("event_id,vendors(business_name,slug)")
      .not("vendor_id", "is", null)
      .returns<{ event_id: string; vendors: { business_name: string; slug: string } | null }[]>()
      .then(({ data }) => {
        const map = new Map<string, EventVendor[]>();
        for (const row of data ?? []) {
          if (!row.vendors) continue;
          const list = map.get(row.event_id) ?? [];
          list.push({ name: row.vendors.business_name, slug: row.vendors.slug });
          map.set(row.event_id, list);
        }
        setVendorsByEventId(map);
      });
  }, []);
  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  function changeMonth(delta: number) {
    setSelectedDate(null);
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function jumpToToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(todayKey);
  }

  return (
    <div className="mt-6">
      {top10Above.length > 0 && <Top10Strip events={top10Above} categoryById={categoryById} />}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </h2>
          {!onCurrentMonth && (
            <button
              type="button"
              onClick={jumpToToday}
              className="rounded-full border border-green-400 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {WEEKDAY_LABELS.map((day, i) => (
          <div key={i}>{day}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const key = toDateKey(cursor.year, cursor.month, day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border-2 text-sm ${
                isSelected
                  ? `border-slate-900 bg-slate-900 text-white${isToday ? " ring-2 ring-green-500 ring-offset-1" : ""}`
                  : isToday
                    ? "live-pulse text-slate-900"
                    : "border-slate-200 text-slate-700"
              } ${dayEvents.length ? "font-semibold" : "text-slate-400"}`}
            >
              {day}
              {dayEvents.length > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {top10Below.length > 0 && <Top10Strip events={top10Below} categoryById={categoryById} />}

      {selectedDate && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-500">
            {formatDateKey(selectedDate)}
            {selectedDate === todayKey && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                <span className="live-pulse h-2 w-2 rounded-full border-2 border-green-600" />
                Today
              </span>
            )}
          </p>
          {selectedEvents.length > 0 ? (
            <div className="mt-3 space-y-4">
              {selectedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  category={categoryById.get(event.category_id ?? "")}
                  vendors={vendorsByEventId.get(event.id) ?? []}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nothing scheduled for this day.</p>
          )}
        </div>
      )}

      {recurringEvents.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-bold text-slate-900">Recurring Markets &amp; Events</h3>
          <p className="mt-1 text-sm text-slate-600">
            Ongoing on a weekly or monthly schedule rather than a single date.
          </p>
          <div className="mt-4 space-y-4">
            {recurringEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                category={categoryById.get(event.category_id ?? "")}
                vendors={vendorsByEventId.get(event.id) ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Top10Strip({ events, categoryById }: { events: LovEntry[]; categoryById: Map<string, Category> }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">🌟 Top 10</h3>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
        {events.map((event) => (
          <a
            key={event.id}
            href={`${BASE_PATH}/board/?flyerId=${encodeURIComponent(event.id)}`}
            className="flex w-40 shrink-0 flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 hover:bg-amber-100"
          >
            {event.flyer_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.flyer_image_url} alt={event.name} className="h-20 w-full rounded-lg object-cover" />
            ) : (
              <FlyerPlaceholder
                seed={event.name}
                icon={categoryById.get(event.category_id ?? "")?.icon}
                className="h-20 w-full rounded-lg"
              />
            )}
            <p className="line-clamp-2 text-xs font-semibold text-slate-900">{event.name}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  category,
  vendors = [],
}: {
  event: LovEntry;
  category?: Category;
  vendors?: EventVendor[];
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      {event.flyer_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.flyer_image_url}
          alt={event.name}
          className="h-28 w-28 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <FlyerPlaceholder
          seed={event.name}
          icon={category?.icon}
          label={category?.name}
          className="h-28 w-28 shrink-0 rounded-lg"
        />
      )}
      <div>
        <p className="font-bold text-slate-900">{event.name}</p>
        {event.event_date && event.end_date && event.end_date !== event.event_date && (
          <p className="text-sm font-medium text-slate-700">
            {formatDateKey(event.event_date.slice(0, 10))} – {formatDateKey(event.end_date.slice(0, 10))}
          </p>
        )}
        {event.recurrence && (
          <p className="text-sm font-medium text-slate-700">{event.recurrence}</p>
        )}
        {event.location && <p className="text-sm text-slate-600">{event.location}</p>}
        <div className="mt-1 flex flex-wrap gap-3">
          {event.instagram_handle && (
            <a
              href={`https://instagram.com/${event.instagram_handle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-slate-900 underline"
            >
              📷 {event.instagram_handle}
            </a>
          )}
          {event.website_url && (
            <a
              href={event.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-slate-900 underline"
            >
              🌐 Website
            </a>
          )}
          {event.ticket_url && (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-slate-900 underline"
            >
              🎟 Tickets
            </a>
          )}
        </div>
        {event.booth_tier === "top" && (
          <span className="mt-1 block text-xs font-semibold text-amber-600">🏆 Top Booth event</span>
        )}
        {vendors.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendors at this event</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {vendors.map((v) => (
                <a
                  key={v.slug}
                  href={`/vendor?slug=${encodeURIComponent(v.slug)}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {v.name}
                </a>
              ))}
            </div>
          </div>
        )}
        {/* Two distinct destinations (the full flyer vs. the map location),
            not a fallback/alternate for each other - styled as clearly
            different weights (solid vs. outline) with extra gap so they're
            not easy to mix up on a small screen. */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a
            href={`${BASE_PATH}/board/?flyerId=${encodeURIComponent(event.id)}`}
            className="inline-block rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            🗒️ View Full Flyer
          </a>
          <a
            href={`${BASE_PATH}/map/?showEvent=${encodeURIComponent(event.id)}`}
            className="inline-block rounded-full border border-indigo-300 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            📍 Find on Map
          </a>
        </div>
      </div>
    </div>
  );
}
