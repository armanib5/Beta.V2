"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Booth, LovEntry } from "@/lib/types";

const STATUS_STYLES: Record<Booth["status"], string> = {
  open: "bg-green-50 border-green-300 text-green-800",
  reserved: "bg-amber-50 border-amber-400 text-amber-800",
  claimed: "bg-red-50 border-red-400 text-red-800",
};

const STATUS_LABEL: Record<Booth["status"], string> = {
  open: "Open",
  reserved: "Reserved",
  claimed: "Occupied",
};

const STATUS_CYCLE: Record<Booth["status"], Booth["status"]> = {
  open: "reserved",
  reserved: "claimed",
  claimed: "open",
};

export function AdminBoard({ events }: { events: LovEntry[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<Booth["tier"]>("regular");

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect kicks off
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("booths")
      .select("*")
      .eq("event_id", eventId)
      .order("label")
      .returns<Booth[]>()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        else setBooths(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function toggleBooth(booth: Booth) {
    setError(null);
    const nextStatus = STATUS_CYCLE[booth.status];
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("booths")
      .update({ status: nextStatus, vendor_id: nextStatus === "open" ? null : undefined })
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();

    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update booth.");
      return;
    }
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  async function addBooth(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !eventId) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("booths")
      .insert({ event_id: eventId, label: newLabel.trim(), tier: newTier })
      .select("*")
      .single<Booth>();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create booth.");
      return;
    }
    setBooths((prev) => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
    setNewLabel("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Venue Board (Admin)</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tap a booth to cycle Open → Reserved → Occupied. Private — not visible to vendors.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Event</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          {events.length === 0 && <option value="">No events yet — seed the LOV first</option>}
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {event.event_date ? ` — ${event.event_date}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
        <Legend swatch="bg-green-100 border-green-400" label="Open" />
        <Legend swatch="bg-amber-100 border-amber-500" label="Reserved" />
        <Legend swatch="bg-red-100 border-red-500" label="Occupied" />
        <Legend swatch="border-amber-500 ring-2 ring-amber-400" label="Top Booth (gold ring)" />
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {loading && <p className="col-span-full text-sm text-slate-500">Loading booths…</p>}
        {!loading &&
          booths.map((booth) => (
            <button
              key={booth.id}
              type="button"
              onClick={() => toggleBooth(booth)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border-2 text-center text-sm font-bold transition ${
                STATUS_STYLES[booth.status]
              } ${booth.tier === "top" ? "ring-2 ring-amber-400" : ""}`}
            >
              <span>{booth.label}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wide">
                {STATUS_LABEL[booth.status]}
              </span>
              {booth.tier === "top" && <span className="text-[10px]">🏆 Top</span>}
            </button>
          ))}
        {!loading && eventId && booths.length === 0 && (
          <p className="col-span-full text-sm text-slate-500">No booths yet for this event.</p>
        )}
      </div>

      {eventId && (
        <form onSubmit={addBooth} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Booth label</label>
            <input
              type="text"
              placeholder="A1"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as Booth["tier"])}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="regular">Regular</option>
              <option value="top">Top Booth</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add Booth
          </button>
        </form>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${swatch}`} />
      {label}
    </span>
  );
}
