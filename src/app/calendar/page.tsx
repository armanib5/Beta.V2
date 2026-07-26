import { createClient } from "@/lib/supabase/server";
import type { LovEntry } from "@/lib/types";
import { EventCalendar } from "@/components/event-calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("lov_entries")
    .select("*")
    .eq("type", "event")
    .order("event_date")
    .returns<LovEntry[]>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Event Calendar</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tap a day with events to see its flyer and details.
      </p>
      <EventCalendar events={events ?? []} />
    </div>
  );
}
