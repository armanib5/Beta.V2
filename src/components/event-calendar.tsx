"use client";

import { useMemo, useState } from "react";
import type { LovEntry } from "@/lib/types";

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

export function EventCalendar({ events }: { events: LovEntry[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, LovEntry[]>();
    for (const event of events) {
      if (!event.event_date) continue;
      for (const key of expandDateRange(event.event_date.slice(0, 10), event.end_date?.slice(0, 10) ?? null)) {
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    }
    return map;
  }, [events]);

  const recurringEvents = useMemo(() => events.filter((event) => !event.event_date), [events]);

  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
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

  const onCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  return (
    <div className="mt-6">
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
                  ? "border-slate-900 bg-slate-900 text-white"
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
                <EventCard key={event.id} event={event} />
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
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: LovEntry }) {
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
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-3xl">
          📅
        </div>
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
        </div>
        {event.booth_tier === "top" && (
          <span className="mt-1 block text-xs font-semibold text-amber-600">🏆 Top Booth event</span>
        )}
      </div>
    </div>
  );
}
