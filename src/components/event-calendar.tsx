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

export function EventCalendar({ events }: { events: LovEntry[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, LovEntry[]>();
    for (const event of events) {
      if (!event.event_date) continue;
      const key = event.event_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

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
        <h2 className="text-lg font-bold text-slate-900">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h2>
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
              onClick={() => setSelectedDate(dayEvents.length ? key : null)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : isToday
                    ? "border-slate-900 text-slate-900"
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
        <div className="mt-6 space-y-4">
          {selectedEvents.map((event) => (
            <div key={event.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
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
                {event.location && <p className="text-sm text-slate-600">{event.location}</p>}
                {event.instagram_handle && (
                  <a
                    href={`https://instagram.com/${event.instagram_handle.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-slate-900 underline"
                  >
                    📷 {event.instagram_handle}
                  </a>
                )}
                {event.booth_tier === "top" && (
                  <span className="mt-1 block text-xs font-semibold text-amber-600">🏆 Top Booth event</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
