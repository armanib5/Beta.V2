"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Booth, LovEntry, Vendor } from "@/lib/types";
import { logActivity } from "@/lib/activity";

const STATUS_STYLES: Record<Booth["status"], string> = {
  open: "bg-green-50 border-green-300 text-green-800",
  reserved: "bg-amber-50 border-amber-400 text-amber-800",
  occupied: "bg-red-50 border-red-400 text-red-800",
};

const STATUS_LABEL: Record<Booth["status"], string> = {
  open: "Open",
  reserved: "Reserved",
  occupied: "Occupied",
};

const STATUS_CYCLE: Record<Booth["status"], Booth["status"]> = {
  open: "reserved",
  reserved: "occupied",
  occupied: "open",
};

/** A flyer a booth can show: either a full paid vendor account or a guest
 * lov_entries listing (a vendor who's only ever been a pin/name so far). */
interface Flyer {
  key: string; // "vendor:<id>" or "lov:<id>"
  name: string;
  image: string | null;
}

function flyerKey(booth: Booth): string {
  if (booth.vendor_id) return `vendor:${booth.vendor_id}`;
  if (booth.lov_entry_id) return `lov:${booth.lov_entry_id}`;
  return "";
}

export function AdminBoard({ events: initialEvents }: { events: LovEntry[] }) {
  const [events, setEvents] = useState<LovEntry[]>(initialEvents);
  const [eventId, setEventId] = useState(initialEvents[0]?.id ?? "");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [flyersByKey, setFlyersByKey] = useState<Record<string, Flyer>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<Booth["tier"]>("standard");
  const [newBoothFlyer, setNewBoothFlyer] = useState("");

  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventPublishAt, setNewEventPublishAt] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(initialEvents.length === 0);

  const [newFlyerName, setNewFlyerName] = useState("");
  const [newFlyerImage, setNewFlyerImage] = useState("");
  const [newFlyerPublishAt, setNewFlyerPublishAt] = useState("");
  const [showNewFlyer, setShowNewFlyer] = useState(false);

  async function loadFlyers() {
    const supabase = createClient();
    const [{ data: vendorRows }, { data: lovRows }] = await Promise.all([
      supabase.from("vendors").select("id,business_name,logo_url").eq("status", "active").returns<
        Pick<Vendor, "id" | "business_name" | "logo_url">[]
      >(),
      supabase.from("lov_entries").select("id,name,flyer_image_url").eq("type", "vendor").returns<
        Pick<LovEntry, "id" | "name" | "flyer_image_url">[]
      >(),
    ]);
    const combined: Flyer[] = [
      ...(vendorRows ?? []).map((v) => ({ key: `vendor:${v.id}`, name: v.business_name, image: v.logo_url })),
      ...(lovRows ?? []).map((l) => ({ key: `lov:${l.id}`, name: l.name, image: l.flyer_image_url })),
    ];
    setFlyers(combined);
    setFlyersByKey(Object.fromEntries(combined.map((f) => [f.key, f])));
  }

  useEffect(() => {
    // Async fetch-then-setState (not a synchronous browser-API read) —
    // the standard fetch-on-mount pattern, not what this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFlyers();
  }, []);

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

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEventName.trim()) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("lov_entries")
      .insert({
        type: "event",
        name: newEventName.trim(),
        event_date: newEventDate || null,
        location: newEventLocation.trim() || null,
        publish_at: newEventPublishAt ? new Date(newEventPublishAt).toISOString() : null,
      })
      .select("*")
      .single<LovEntry>();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create event.");
      return;
    }
    logActivity(
      supabase,
      "event",
      data.id,
      data.name,
      "Created",
      data.publish_at ? `Scheduled to publish ${new Date(data.publish_at).toLocaleString("en-US")}` : (data.location ?? undefined),
    );
    setEvents((prev) => [data, ...prev]);
    setEventId(data.id);
    setNewEventName("");
    setNewEventDate("");
    setNewEventLocation("");
    setNewEventPublishAt("");
    setShowNewEvent(false);
  }

  async function createFlyer(e: React.FormEvent) {
    e.preventDefault();
    if (!newFlyerName.trim()) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("lov_entries")
      .insert({
        type: "vendor",
        name: newFlyerName.trim(),
        flyer_image_url: newFlyerImage.trim() || null,
        publish_at: newFlyerPublishAt ? new Date(newFlyerPublishAt).toISOString() : null,
      })
      .select("*")
      .single<LovEntry>();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create vendor flyer.");
      return;
    }
    logActivity(
      supabase,
      "vendor",
      data.id,
      data.name,
      "Created flyer",
      data.publish_at ? `Scheduled to publish ${new Date(data.publish_at).toLocaleString("en-US")}` : undefined,
    );
    const flyer: Flyer = { key: `lov:${data.id}`, name: data.name, image: data.flyer_image_url };
    setFlyers((prev) => [...prev, flyer]);
    setFlyersByKey((prev) => ({ ...prev, [flyer.key]: flyer }));
    setNewBoothFlyer(flyer.key);
    setNewFlyerName("");
    setNewFlyerImage("");
    setNewFlyerPublishAt("");
    setShowNewFlyer(false);
  }

  function flyerFields(key: string): { vendor_id: string | null; lov_entry_id: string | null } {
    if (key.startsWith("vendor:")) return { vendor_id: key.slice(7), lov_entry_id: null };
    if (key.startsWith("lov:")) return { vendor_id: null, lov_entry_id: key.slice(4) };
    return { vendor_id: null, lov_entry_id: null };
  }

  async function assignFlyer(booth: Booth, key: string) {
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("booths")
      .update(flyerFields(key))
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();

    if (updateError || !data) {
      setError(updateError?.message ?? "Could not assign vendor.");
      return;
    }
    const flyerName = flyersByKey[key]?.name ?? "no vendor";
    logActivity(supabase, "booth", data.id, `Booth ${data.label}`, "Assigned vendor", flyerName);
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  async function toggleBooth(booth: Booth) {
    setError(null);
    const nextStatus = STATUS_CYCLE[booth.status];
    const reopening = nextStatus === "open";
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("booths")
      .update({
        status: nextStatus,
        vendor_id: reopening ? null : undefined,
        lov_entry_id: reopening ? null : undefined,
      })
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();

    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update booth.");
      return;
    }
    logActivity(supabase, "booth", data.id, `Booth ${data.label}`, `Status → ${nextStatus}`);
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  async function addBooth(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !eventId) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("booths")
      .insert({
        event_id: eventId,
        label: newLabel.trim(),
        tier: newTier,
        ...flyerFields(newBoothFlyer),
      })
      .select("*")
      .single<Booth>();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create booth.");
      return;
    }
    logActivity(supabase, "booth", data.id, `Booth ${data.label}`, "Created", newTier === "top" ? "Top Booth" : undefined);
    setBooths((prev) => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
    setNewLabel("");
    setNewBoothFlyer("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Venue Board (Admin)</h1>
        <div className="flex gap-4">
          <Link href="/admin/zones" className="text-sm font-semibold text-slate-700 underline">
            Event Zone Studio →
          </Link>
          <Link href="/admin/vendors" className="text-sm font-semibold text-slate-700 underline">
            Vendor Approvals →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Tap a booth to cycle Open → Reserved → Occupied. Private — not visible to vendors.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Event</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {events.length === 0 && <option value="">No events yet — create one below</option>}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
                {event.event_date ? ` — ${event.event_date}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewEvent((s) => !s)}
            className="text-sm font-semibold text-slate-700 underline"
          >
            {showNewEvent ? "Cancel" : "+ New event"}
          </button>
        </div>

        {showNewEvent && (
          <form
            onSubmit={createEvent}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700">Event name</label>
              <input
                type="text"
                placeholder="Music in the Park"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Location</label>
              <input
                type="text"
                placeholder="Plaza de César Chávez"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                className="mt-1 w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Publish date <span className="font-normal text-slate-400">(blank = live now)</span>
              </label>
              <input
                type="datetime-local"
                value={newEventPublishAt}
                onChange={(e) => setNewEventPublishAt(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Create Event
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
        <Legend swatch="bg-green-100 border-green-400" label="Open" />
        <Legend swatch="bg-amber-100 border-amber-500" label="Reserved" />
        <Legend swatch="bg-red-100 border-red-500" label="Occupied" />
        <Legend swatch="border-amber-500 ring-2 ring-amber-400" label="Top Booth (gold ring)" />
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {loading && <p className="col-span-full text-sm text-slate-500">Loading booths…</p>}
        {!loading &&
          booths.map((booth) => {
            const flyer = flyersByKey[flyerKey(booth)];
            return (
              <div
                key={booth.id}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-center text-sm font-bold transition ${
                  STATUS_STYLES[booth.status]
                } ${booth.tier === "top" ? "ring-2 ring-amber-400" : ""}`}
              >
                <button type="button" onClick={() => toggleBooth(booth)} className="flex w-full flex-col items-center">
                  {flyer?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, arbitrary external flyer URLs
                    <img src={flyer.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/60 text-[10px] font-normal text-slate-400">
                      No flyer
                    </span>
                  )}
                  <span className="mt-1">{booth.label}</span>
                  {flyer && <span className="max-w-full truncate text-[10px] font-medium">{flyer.name}</span>}
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {STATUS_LABEL[booth.status]}
                  </span>
                  {booth.tier === "top" && <span className="text-[10px]">🏆 Top</span>}
                </button>
                <select
                  value={flyerKey(booth)}
                  onChange={(e) => assignFlyer(booth, e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] font-normal text-slate-700"
                >
                  <option value="">No vendor</option>
                  {flyers.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
              <option value="standard">Standard</option>
              <option value="top">Top Booth</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Vendor / flyer</label>
            <select
              value={newBoothFlyer}
              onChange={(e) => setNewBoothFlyer(e.target.value)}
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None yet</option>
              {flyers.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Add Booth
          </button>
          <button
            type="button"
            onClick={() => setShowNewFlyer((s) => !s)}
            className="text-sm font-semibold text-slate-700 underline"
          >
            {showNewFlyer ? "Cancel" : "+ New vendor flyer"}
          </button>
        </form>
      )}

      {showNewFlyer && (
        <form onSubmit={createFlyer} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Vendor name</label>
            <input
              type="text"
              placeholder="Bunbao"
              value={newFlyerName}
              onChange={(e) => setNewFlyerName(e.target.value)}
              className="mt-1 w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Flyer image URL (optional)</label>
            <input
              type="text"
              placeholder="https://…"
              value={newFlyerImage}
              onChange={(e) => setNewFlyerImage(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Publish date <span className="font-normal text-slate-400">(blank = live now)</span>
            </label>
            <input
              type="datetime-local"
              value={newFlyerPublishAt}
              onChange={(e) => setNewFlyerPublishAt(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Create Flyer
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
