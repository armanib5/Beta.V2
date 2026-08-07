// Shared "what matters most right now" ordering for events across the
// Calendar and Directory - plain `.order("event_date")` ascending puts
// any still-"active" PAST event (never archived) ahead of a real
// upcoming one, since an earlier date always sorts first regardless of
// whether it already happened. This buckets by relevance first, then
// sorts chronologically within each bucket.

import { parseRecurrence } from "./recurrence";

export type EventPriorityBucket = "now" | "today" | "tomorrow" | "week" | "later" | "past";

const BUCKET_ORDER: Record<EventPriorityBucket, number> = {
  now: 0,
  today: 1,
  tomorrow: 2,
  week: 3,
  later: 4,
  past: 5,
};

export const BUCKET_LABEL: Record<EventPriorityBucket, string> = {
  now: "Happening Now",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This Week",
  later: "Later",
  past: "Archived / Past",
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface EventPriorityInput {
  event_date: string | null;
  end_date: string | null;
  recurrence: string | null;
}

export function eventPriorityBucket(event: EventPriorityInput, now: Date = new Date()): EventPriorityBucket {
  const todayKey = dateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = dateKey(weekEnd);

  if (event.event_date) {
    const startKey = event.event_date.slice(0, 10);
    const endKey = (event.end_date ?? event.event_date).slice(0, 10);
    if (startKey <= todayKey && endKey >= todayKey) return "now"; // spans today (e.g. a multi-day festival)
    if (startKey === todayKey) return "today";
    if (startKey === tomorrowKey) return "tomorrow";
    if (startKey > todayKey && startKey <= weekEndKey) return "week";
    if (startKey > weekEndKey) return "later";
    return "past";
  }
  if (event.recurrence) {
    // A recurring event with no specific date is "happening now" on the
    // day of week it actually recurs on, and otherwise stays visible in
    // "This Week" rather than falling into "Later"/"Past" just because
    // it has no single event_date to compare.
    const { dayOfWeek } = parseRecurrence(event.recurrence);
    if (dayOfWeek === now.getDay()) return "now";
    return "week";
  }
  return "later";
}

export function compareEventPriority<T extends EventPriorityInput>(a: T, b: T, now: Date = new Date()): number {
  const bucketA = eventPriorityBucket(a, now);
  const bucketB = eventPriorityBucket(b, now);
  if (BUCKET_ORDER[bucketA] !== BUCKET_ORDER[bucketB]) return BUCKET_ORDER[bucketA] - BUCKET_ORDER[bucketB];
  const dateA = a.event_date ?? "9999-12-31";
  const dateB = b.event_date ?? "9999-12-31";
  // Most-recent-first within Past (the most recently ended event is the
  // most relevant "just happened" one); soonest-first everywhere else.
  return bucketA === "past" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
}
