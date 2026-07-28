"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import type { Booth, BoundaryType, LovEntry, Vendor, ZoneBoundary, ZoneBoundaryPoint } from "@/lib/types";
import { ZoneMap } from "@/components/zone-map";

const STATUS_CYCLE: Record<Booth["status"], Booth["status"]> = {
  open: "reserved",
  reserved: "occupied",
  occupied: "open",
};

const BOUNDARY_TYPES: BoundaryType[] = ["fence", "gate", "exit", "vendor_area"];

function parsePoints(raw: string): ZoneBoundaryPoint[] {
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(",").map((n) => Number(n.trim()));
      return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
    });
}

export default function AdminZonesPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [eventId, setEventId] = useState("");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [boundaries, setBoundaries] = useState<ZoneBoundary[]>([]);
  const [loadingZone, setLoadingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [newNumber, setNewNumber] = useState("");
  const [newTier, setNewTier] = useState<Booth["tier"]>("standard");
  const [newX, setNewX] = useState("");
  const [newY, setNewY] = useState("");
  const [newWidth, setNewWidth] = useState("8");
  const [newHeight, setNewHeight] = useState("8");
  const [newVendorId, setNewVendorId] = useState("");

  const [newBoundaryType, setNewBoundaryType] = useState<BoundaryType>("fence");
  const [newBoundaryLabel, setNewBoundaryLabel] = useState("");
  const [newBoundaryPoints, setNewBoundaryPoints] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data }, { data: vendorRows }] = await Promise.all([
        supabase
          .from("lov_entries")
          .select("*")
          .eq("type", "event")
          .order("event_date", { ascending: false })
          .returns<LovEntry[]>(),
        supabase.from("vendors").select("*").eq("status", "active").eq("is_internal", false).returns<Vendor[]>(),
      ]);
      if (cancelled) return;
      setEvents(data ?? []);
      setEventId(data?.[0]?.id ?? "");
      setVendors(vendorRows ?? []);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale data when the event picker is reset
      setBooths([]);
      setBoundaries([]);
      return;
    }
    let cancelled = false;
    setLoadingZone(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("booths").select("*").eq("event_id", eventId).order("booth_number").returns<Booth[]>(),
      supabase.from("zone_boundaries").select("*").eq("event_id", eventId).returns<ZoneBoundary[]>(),
    ]).then(([boothRes, boundaryRes]) => {
      if (cancelled) return;
      if (boothRes.error) setError(boothRes.error.message);
      else setBooths(boothRes.data ?? []);
      setBoundaries(boundaryRes.data ?? []);
      setLoadingZone(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleBoothClick(booth: Booth) {
    setError(null);
    const nextStatus = STATUS_CYCLE[booth.status];
    const reopening = nextStatus === "open";
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("booths")
      .update({ status: nextStatus, vendor_id: reopening ? null : undefined })
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update booth.");
      return;
    }
    logActivity(supabase, "booth", data.id, `Booth ${data.booth_number ?? data.label}`, `Status → ${nextStatus}`);
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  async function addBooth(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId || !newNumber.trim()) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("booths")
      .insert({
        event_id: eventId,
        label: newNumber.trim(),
        booth_number: Number(newNumber.trim()) || null,
        tier: newTier,
        x: newX.trim() ? Number(newX.trim()) : null,
        y: newY.trim() ? Number(newY.trim()) : null,
        width: newWidth.trim() ? Number(newWidth.trim()) : null,
        height: newHeight.trim() ? Number(newHeight.trim()) : null,
        vendor_id: newVendorId || null,
        status: newVendorId ? "occupied" : "open",
      })
      .select("*")
      .single<Booth>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create booth.");
      return;
    }
    const vendorName = vendors.find((v) => v.id === newVendorId)?.business_name;
    logActivity(
      supabase,
      "booth",
      data.id,
      `Booth ${data.booth_number ?? data.label}`,
      "Created",
      [newTier === "top" ? "Top Booth" : undefined, vendorName ? `Assigned to ${vendorName}` : undefined]
        .filter(Boolean)
        .join(", "),
    );
    setBooths((prev) => [...prev, data]);
    setNewNumber("");
    setNewX("");
    setNewY("");
    setNewVendorId("");
  }

  async function assignBoothVendor(booth: Booth, vendorId: string) {
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("booths")
      .update({ vendor_id: vendorId || null, status: vendorId ? "occupied" : "open" })
      .eq("id", booth.id)
      .select("*")
      .single<Booth>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not assign vendor.");
      return;
    }
    const vendorName = vendors.find((v) => v.id === vendorId)?.business_name ?? "no vendor";
    logActivity(supabase, "booth", data.id, `Booth ${data.booth_number ?? data.label}`, "Assigned vendor", vendorName);
    setBooths((prev) => prev.map((b) => (b.id === booth.id ? data : b)));
  }

  async function addBoundary(e: React.FormEvent) {
    e.preventDefault();
    const points = parsePoints(newBoundaryPoints);
    if (!eventId || points.length === 0) return;
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("zone_boundaries")
      .insert({
        event_id: eventId,
        boundary_type: newBoundaryType,
        label: newBoundaryLabel.trim() || null,
        points,
      })
      .select("*")
      .single<ZoneBoundary>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create boundary.");
      return;
    }
    setBoundaries((prev) => [...prev, data]);
    setNewBoundaryLabel("");
    setNewBoundaryPoints("");
  }

  async function deleteBoundary(id: string) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("zone_boundaries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setBoundaries((prev) => prev.filter((b) => b.id !== id));
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
        <p className="mt-3 text-sm text-slate-600">
          Log in with an account listed in the <code>admins</code> table to manage the event zone map.
        </p>
        <Link href="/vendor/login" className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Event Zone Map (Admin)</h1>
        <Link href="/admin/board" className="text-sm font-semibold text-slate-700 underline">
          Venue Board →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Tap a booth to cycle Open → Reserved → Occupied. Add fences, gates, exits, and vendor areas below.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Event</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          {events.length === 0 && <option value="">No events yet — create one in Venue Board</option>}
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {event.event_date ? ` — ${event.event_date}` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6">
        {loadingZone && <p className="text-sm text-slate-500">Loading zone map…</p>}
        {!loadingZone && eventId && (
          <ZoneMap
            booths={booths}
            boundaries={boundaries}
            mode="admin"
            onBoothClick={handleBoothClick}
            vendorNameById={Object.fromEntries(vendors.map((v) => [v.id, v.business_name]))}
          />
        )}
        {!loadingZone && eventId && booths.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No booths yet for this event — add one below.</p>
        )}
      </div>

      {booths.length > 0 && (
        <div className="mt-3 space-y-1">
          {booths.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="font-semibold text-slate-800">
                Booth {b.booth_number ?? b.label} <span className="text-xs font-normal text-slate-400">({b.status})</span>
              </span>
              <select
                value={b.vendor_id ?? ""}
                onChange={(e) => assignBoothVendor(b, e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">Unassigned</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.business_name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {eventId && (
        <form onSubmit={addBooth} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Booth #</label>
            <input
              type="text"
              placeholder="1"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            <label className="block text-xs font-medium text-slate-700">X% (optional)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={newX}
              onChange={(e) => setNewX(e.target.value)}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Y% (optional)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={newY}
              onChange={(e) => setNewY(e.target.value)}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Width %</label>
            <input
              type="number"
              min={1}
              max={100}
              value={newWidth}
              onChange={(e) => setNewWidth(e.target.value)}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Height %</label>
            <input
              type="number"
              min={1}
              max={100}
              value={newHeight}
              onChange={(e) => setNewHeight(e.target.value)}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Vendor (optional)</label>
            <select
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Add Booth
          </button>
        </form>
      )}

      {eventId && (
        <form onSubmit={addBoundary} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Boundary type</label>
            <select
              value={newBoundaryType}
              onChange={(e) => setNewBoundaryType(e.target.value as BoundaryType)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {BOUNDARY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Label (optional)</label>
            <input
              type="text"
              placeholder="North Fence"
              value={newBoundaryLabel}
              onChange={(e) => setNewBoundaryLabel(e.target.value)}
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Points <span className="font-normal text-slate-400">(x,y; x,y; … — 0-100 grid)</span>
            </label>
            <input
              type="text"
              placeholder="10,10; 90,10"
              value={newBoundaryPoints}
              onChange={(e) => setNewBoundaryPoints(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Add Boundary
          </button>
        </form>
      )}

      {boundaries.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {boundaries.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span>
                <strong className="capitalize">{b.boundary_type.replace("_", " ")}</strong>
                {b.label ? ` — ${b.label}` : ""} ({b.points.length} points)
              </span>
              <button type="button" onClick={() => deleteBoundary(b.id)} className="text-xs font-semibold text-red-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
