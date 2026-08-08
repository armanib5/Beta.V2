"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { CITY_CENTERS, nearestCityCenter } from "@/lib/geo";
import type { Booth, BoundaryType, LovEntry, Vendor, ZoneBoundary, ZoneBoundaryPoint, ZoneBoundaryGeoPoint, ZoneFeature } from "@/lib/types";
import { ZoneMap } from "@/components/zone-map";
import { ZoneBoundaryDrawer } from "@/components/zone-boundary-drawer";
import { ZoneMapLeaflet, FEATURE_TYPE_LABEL, type PlacingType, type ZoneMapContextPin } from "@/components/zone-map-leaflet";

function cityOfEvent(e: LovEntry): string {
  if (e.section_zone) {
    const bySection = CITY_CENTERS.find((c) => c.section === e.section_zone);
    if (bySection) return bySection.city;
  }
  if (e.lat !== null && e.lng !== null) return nearestCityCenter(e.lat, e.lng).city;
  return "Unknown";
}

type EventTiming = "now" | "soon" | "upcoming" | "past";

/** "now"/"soon" cover multi-day or recurring events currently in their
 * window; "past" is what should get cleaned up (suspended/removed) — this
 * is purely a sort/label helper, it never writes anything. */
function timingOfEvent(e: LovEntry, today: string): EventTiming {
  const start = e.event_date?.slice(0, 10) ?? null;
  const end = (e.end_date ?? e.event_date)?.slice(0, 10) ?? null;
  if (!start) return e.recurrence ? "now" : "upcoming";
  if (end && end < today) return "past";
  if (start > today) {
    const daysOut = (new Date(start).getTime() - new Date(today).getTime()) / 86400000;
    return daysOut <= 7 ? "soon" : "upcoming";
  }
  return "now";
}

const TIMING_LABEL: Record<EventTiming, string> = {
  now: "🟢 Happening Now",
  soon: "🟡 Happening Soon",
  upcoming: "🔵 Upcoming",
  past: "⚪ Past",
};
const TIMING_ORDER: Record<EventTiming, number> = { now: 0, soon: 1, upcoming: 2, past: 3 };

const STATUS_CYCLE: Record<Booth["status"], Booth["status"]> = {
  open: "reserved",
  reserved: "occupied",
  occupied: "open",
};

const BOUNDARY_TYPES: BoundaryType[] = ["fence", "gate", "exit", "vendor_area"];

const PLACEABLE_TYPES: PlacingType[] = [
  "booth",
  "stage",
  "seating",
  "food",
  "bar",
  "gate",
  "entrance",
  "exit",
  "info",
  "restroom",
];

/** Roughly 1.5 miles - close enough to show real spatial context (nearby
 * businesses/other events) without pulling in half the city. Pure display
 * reference while tracing, not a hard boundary of any kind. */
const CONTEXT_RADIUS_DEG = 0.022;

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

/** A row is "legacy" if it has real percentage-grid data and no real-world
 * event boundary has been traced yet for it - Farmers Market's condition
 * can only ever resolve here, so its existing layout is provably unchanged
 * by this page. Everything else (including a brand-new event with zero
 * zone data) goes straight to the new Leaflet editor. */
function computeDataMode(booths: Booth[], boundaries: ZoneBoundary[]): "legacy" | "geo" {
  const hasLegacyData = booths.some((b) => b.x != null || b.y != null) || boundaries.some((b) => b.points.length > 0);
  const hasGeoEventBoundary = boundaries.some(
    (b) => b.boundary_type === "event_boundary" && b.points_geo && b.points_geo.length >= 3,
  );
  return hasLegacyData && !hasGeoEventBoundary ? "legacy" : "geo";
}

export default function AdminZonesPage() {
  const [status, setStatus] = useState<"loading" | "denied" | "ready">("loading");
  const [events, setEvents] = useState<LovEntry[]>([]);
  const [eventId, setEventId] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [boundaries, setBoundaries] = useState<ZoneBoundary[]>([]);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [loadingZone, setLoadingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }

  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Legacy (percentage-grid) form state - unchanged.
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
  const [drawMode, setDrawMode] = useState(true);
  const [drawnPoints, setDrawnPoints] = useState<ZoneBoundaryPoint[]>([]);
  const [copyFromEventId, setCopyFromEventId] = useState("");
  const [copying, setCopying] = useState(false);

  // Geo (real Leaflet map) state - new.
  const [zoneUiMode, setZoneUiMode] = useState<"view" | "draw-boundary" | "place-features">("view");
  const [drawnGeoPoints, setDrawnGeoPoints] = useState<ZoneBoundaryGeoPoint[]>([]);
  const [placingType, setPlacingType] = useState<PlacingType | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{ lat: number; lng: number } | null>(null);
  const [placingLabel, setPlacingLabel] = useState("");
  const [previewPublic, setPreviewPublic] = useState(false);
  const [zonedEventIds, setZonedEventIds] = useState<Set<string>>(new Set());
  const [placementHint, setPlacementHint] = useState<string | null>(null);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [editingFeatureLabel, setEditingFeatureLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    checkIsAdmin(supabase).then(async (isAdmin) => {
      if (cancelled) return;
      if (!isAdmin) {
        setStatus("denied");
        return;
      }
      const [{ data }, { data: vendorRows }, { data: boundaryRows }] = await Promise.all([
        supabase
          .from("lov_entries")
          .select("*")
          .eq("type", "event")
          .order("event_date", { ascending: false })
          .returns<LovEntry[]>(),
        supabase.from("vendors").select("*").eq("status", "active").eq("is_internal", false).returns<Vendor[]>(),
        // Which events already have a real traced footprint - drives the
        // "Existing Event Zones" list below so an admin can find one (e.g.
        // First Friday Art Walk) without knowing to search a giant
        // all-events dropdown that doesn't say which ones have a zone yet.
        supabase
          .from("zone_boundaries")
          .select("event_id, points_geo")
          .eq("boundary_type", "event_boundary")
          .returns<{ event_id: string; points_geo: ZoneBoundaryGeoPoint[] | null }[]>(),
      ]);
      if (cancelled) return;
      setEvents(data ?? []);
      setEventId(data?.[0]?.id ?? "");
      setVendors(vendorRows ?? []);
      setZonedEventIds(new Set((boundaryRows ?? []).filter((b) => (b.points_geo?.length ?? 0) >= 3).map((b) => b.event_id)));
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
      setFeatures([]);
      return;
    }
    let cancelled = false;
    setLoadingZone(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("booths").select("*").eq("event_id", eventId).order("booth_number").returns<Booth[]>(),
      supabase.from("zone_boundaries").select("*").eq("event_id", eventId).returns<ZoneBoundary[]>(),
      supabase.from("zone_features").select("*").eq("event_id", eventId).returns<ZoneFeature[]>(),
    ]).then(([boothRes, boundaryRes, featureRes]) => {
      if (cancelled) return;
      if (boothRes.error) setError(boothRes.error.message);
      else setBooths(boothRes.data ?? []);
      setBoundaries(boundaryRes.data ?? []);
      setFeatures(featureRes.data ?? []);
      setLoadingZone(false);
      setZoneUiMode("view");
      setDrawnGeoPoints([]);
      setPlacingType(null);
      setPendingPlacement(null);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const groupedEventsByCity = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    const filtered = query ? events.filter((e) => e.name.toLowerCase().includes(query)) : events;
    const map = new Map<string, LovEntry[]>();
    for (const e of filtered) {
      const city = cityOfEvent(e);
      const list = map.get(city) ?? [];
      list.push(e);
      map.set(city, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const timingDiff = TIMING_ORDER[timingOfEvent(a, todayKey)] - TIMING_ORDER[timingOfEvent(b, todayKey)];
        if (timingDiff !== 0) return timingDiff;
        const dateDiff = (b.event_date ?? "").localeCompare(a.event_date ?? "");
        // Recurring/dateless events (e.g. a monthly Art Walk) otherwise tie
        // on an empty date and fall back to whatever order Supabase
        // happened to return them in - alphabetical keeps the list scannable
        // instead of effectively random.
        return dateDiff !== 0 ? dateDiff : a.name.localeCompare(b.name);
      });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events, todayKey, eventSearch]);

  const zonedEvents = useMemo(
    () =>
      events
        .filter((e) => zonedEventIds.has(e.id))
        .sort((a, b) => TIMING_ORDER[timingOfEvent(a, todayKey)] - TIMING_ORDER[timingOfEvent(b, todayKey)] || a.name.localeCompare(b.name)),
    [events, zonedEventIds, todayKey],
  );

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const dataMode = useMemo(() => computeDataMode(booths, boundaries), [booths, boundaries]);
  const geoBoundaries = useMemo(() => boundaries.filter((b) => b.points_geo && b.points_geo.length > 0), [boundaries]);
  const geoBooths = useMemo(() => booths.filter((b) => b.lat != null && b.lng != null), [booths]);
  const eventBoundary = geoBoundaries.find((b) => b.boundary_type === "event_boundary" && (b.points_geo?.length ?? 0) >= 3) ?? null;

  const mapCenter = useMemo(() => {
    if (selectedEvent?.lat != null && selectedEvent?.lng != null) return { lat: selectedEvent.lat, lng: selectedEvent.lng };
    const anchor = CITY_CENTERS[0];
    return { lat: anchor.lat, lng: anchor.lng };
  }, [selectedEvent]);

  // Nearby vendors/events for spatial reference while tracing - reuses data
  // already loaded on this page, no extra query.
  const contextPins: ZoneMapContextPin[] = useMemo(() => {
    if (!selectedEvent?.lat || !selectedEvent?.lng) return [];
    const near = (lat: number | null, lng: number | null) =>
      lat != null &&
      lng != null &&
      Math.abs(lat - selectedEvent.lat!) < CONTEXT_RADIUS_DEG &&
      Math.abs(lng - selectedEvent.lng!) < CONTEXT_RADIUS_DEG;
    const vendorPins: ZoneMapContextPin[] = vendors
      .filter((v) => near(v.lat, v.lng))
      .map((v) => ({ id: `vendor-${v.id}`, lat: v.lat!, lng: v.lng!, label: v.business_name, emoji: "\u{1F3EA}" }));
    const eventPins: ZoneMapContextPin[] = events
      .filter((e) => e.id !== eventId && near(e.lat, e.lng))
      .map((e) => ({ id: `event-${e.id}`, lat: e.lat!, lng: e.lng!, label: e.name, emoji: "\u{1F3AA}" }));
    return [...vendorPins, ...eventPins];
  }, [vendors, events, selectedEvent, eventId]);

  const zoneMapMode = previewPublic ? "public" : zoneUiMode === "view" ? "view" : zoneUiMode;

  async function handleBoothClick(booth: Booth) {
    if (previewPublic) return;
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
    flash(`✓ Booth ${data.booth_number ?? data.label} → ${nextStatus}`);
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
    flash(`✓ Added Booth ${data.booth_number ?? data.label}`);
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
    flash(`✓ Booth ${data.booth_number ?? data.label} assigned to ${vendorName}`);
  }

  async function addBoundary(e: React.FormEvent) {
    e.preventDefault();
    const points = drawMode ? drawnPoints : parsePoints(newBoundaryPoints);
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
    flash(`✓ Added ${data.boundary_type.replace("_", " ")} boundary`);
    setNewBoundaryLabel("");
    setNewBoundaryPoints("");
    setDrawnPoints([]);
  }

  /** Repost a past event's zone layout onto a new/repeating occurrence
   * instead of redrawing it from scratch — booths and boundaries copy
   * over with the same positions/shapes/tiers (percentage grid or real
   * lat/lng, whichever the source event used), but vendor claims and
   * occupied/reserved status reset since it's a fresh event instance. */
  async function copyZoneLayout() {
    if (!eventId || !copyFromEventId || copyFromEventId === eventId) return;
    setError(null);
    setCopying(true);
    const supabase = createClient();
    const [{ data: sourceBooths }, { data: sourceBoundaries }] = await Promise.all([
      supabase.from("booths").select("*").eq("event_id", copyFromEventId).returns<Booth[]>(),
      supabase.from("zone_boundaries").select("*").eq("event_id", copyFromEventId).returns<ZoneBoundary[]>(),
    ]);
    if (!sourceBooths?.length && !sourceBoundaries?.length) {
      setError("That event has no saved zone layout to copy.");
      setCopying(false);
      return;
    }
    const [boothRes, boundaryRes] = await Promise.all([
      sourceBooths?.length
        ? supabase
            .from("booths")
            .insert(
              sourceBooths.map((b) => ({
                event_id: eventId,
                label: b.label,
                booth_number: b.booth_number,
                tier: b.tier,
                status: "open" as const,
                vendor_id: null,
                lov_entry_id: null,
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                lat: b.lat,
                lng: b.lng,
              })),
            )
            .select("*")
            .returns<Booth[]>()
        : Promise.resolve({ data: [] as Booth[], error: null }),
      sourceBoundaries?.length
        ? supabase
            .from("zone_boundaries")
            .insert(
              sourceBoundaries.map((b) => ({
                event_id: eventId,
                boundary_type: b.boundary_type,
                label: b.label,
                points: b.points,
                points_geo: b.points_geo,
                vendor_id: null,
              })),
            )
            .select("*")
            .returns<ZoneBoundary[]>()
        : Promise.resolve({ data: [] as ZoneBoundary[], error: null }),
    ]);
    setCopying(false);
    if (boothRes.error || boundaryRes.error) {
      setError(boothRes.error?.message ?? boundaryRes.error?.message ?? "Could not copy zone layout.");
      return;
    }
    setBooths((prev) => [...prev, ...(boothRes.data ?? [])]);
    setBoundaries((prev) => [...prev, ...(boundaryRes.data ?? [])]);
    flash(`✓ Copied zone layout (${boothRes.data?.length ?? 0} booths, ${boundaryRes.data?.length ?? 0} boundaries)`);
    setCopyFromEventId("");
  }

  async function deleteBoundary(b: ZoneBoundary) {
    if (!window.confirm(`Remove this ${b.boundary_type.replace("_", " ")}${b.label ? ` (${b.label})` : ""}?`)) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("zone_boundaries").delete().eq("id", b.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setBoundaries((prev) => prev.filter((x) => x.id !== b.id));
    if (b.boundary_type === "event_boundary") {
      setZonedEventIds((prev) => {
        const next = new Set(prev);
        next.delete(b.event_id);
        return next;
      });
    }
    flash(`✓ Removed ${b.boundary_type.replace("_", " ")}`);
  }

  // --- Geo mode: boundary tracing -------------------------------------------------

  function startTraceBoundary() {
    setZoneUiMode("draw-boundary");
    setDrawnGeoPoints([]);
    setError(null);
  }

  function undoLastGeoPoint() {
    setDrawnGeoPoints((prev) => prev.slice(0, -1));
  }

  async function finishTraceBoundary() {
    if (!eventId || drawnGeoPoints.length < 3) {
      setError("Trace at least 3 points to close the boundary shape.");
      return;
    }
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("zone_boundaries")
      .insert({ event_id: eventId, boundary_type: "event_boundary", points: [], points_geo: drawnGeoPoints })
      .select("*")
      .single<ZoneBoundary>();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save the event boundary.");
      return;
    }
    setBoundaries((prev) => [...prev, data]);
    setDrawnGeoPoints([]);
    setZoneUiMode("view");
    setZonedEventIds((prev) => new Set(prev).add(eventId));
    flash("✓ Event boundary saved");
  }

  async function editEventBoundary() {
    if (!eventBoundary) return;
    if (!window.confirm("Redraw the event boundary? The current traced shape will be deleted so you can retrace it.")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("zone_boundaries").delete().eq("id", eventBoundary.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setBoundaries((prev) => prev.filter((b) => b.id !== eventBoundary.id));
    setZonedEventIds((prev) => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    flash("✓ Boundary cleared — retrace it now");
    startTraceBoundary();
  }

  // --- Geo mode: feature placement -------------------------------------------------

  function startPlacing(type: PlacingType) {
    setZoneUiMode("place-features");
    setPlacingType(type);
    setPendingPlacement(null);
    setPlacingLabel("");
    setError(null);
    setPlacementHint(null);
  }

  function stopPlacing() {
    setZoneUiMode("view");
    setPlacingType(null);
    setPendingPlacement(null);
    setPlacingLabel("");
    setPlacementHint(null);
  }

  // Shown right next to the map/palette (not the page-top error banner,
  // which is easy to scroll past on a phone-height screen) so a click that
  // lands outside the traced boundary - the most common reason "placing a
  // stage/booth does nothing" - is impossible to miss: it fires right where
  // the admin is already looking.
  function handleGeoPlaceRejected(reason: string) {
    setPlacementHint(reason);
  }

  function handleGeoPlacePoint(point: { lat: number; lng: number }) {
    setPlacementHint(null);
    setPendingPlacement(point);
  }

  async function savePendingPlacement() {
    if (!pendingPlacement || !placingType || !eventId) return;
    setError(null);
    const supabase = createClient();
    if (placingType === "booth") {
      const nextNumber = Math.max(0, ...booths.map((b) => b.booth_number ?? 0)) + 1;
      const { data, error: insertError } = await supabase
        .from("booths")
        .insert({
          event_id: eventId,
          label: placingLabel.trim() || String(nextNumber),
          booth_number: nextNumber,
          tier: "standard",
          status: "open",
          lat: pendingPlacement.lat,
          lng: pendingPlacement.lng,
        })
        .select("*")
        .single<Booth>();
      if (insertError || !data) {
        setError(insertError?.message ?? "Could not place booth.");
        return;
      }
      logActivity(supabase, "booth", data.id, `Booth ${data.booth_number}`, "Placed on Event Zone map");
      setBooths((prev) => [...prev, data]);
      flash(`✓ Placed Booth ${data.booth_number}`);
    } else {
      const { data, error: insertError } = await supabase
        .from("zone_features")
        .insert({
          event_id: eventId,
          feature_type: placingType,
          label: placingLabel.trim() || null,
          lat: pendingPlacement.lat,
          lng: pendingPlacement.lng,
        })
        .select("*")
        .single<ZoneFeature>();
      if (insertError || !data) {
        setError(insertError?.message ?? "Could not place feature.");
        return;
      }
      setFeatures((prev) => [...prev, data]);
      flash(`✓ Placed ${FEATURE_TYPE_LABEL[placingType]}`);
    }
    setPendingPlacement(null);
    setPlacingLabel("");
  }

  async function saveFeatureLabel(f: ZoneFeature) {
    const nextLabel = editingFeatureLabel.trim() || null;
    setEditingFeatureId(null);
    if (nextLabel === f.label) return;
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("zone_features")
      .update({ label: nextLabel })
      .eq("id", f.id)
      .select("*")
      .single<ZoneFeature>();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not update label.");
      return;
    }
    setFeatures((prev) => prev.map((x) => (x.id === f.id ? data : x)));
    flash(`✓ Updated ${FEATURE_TYPE_LABEL[f.feature_type]} label`);
  }

  async function deleteFeature(f: ZoneFeature) {
    if (!window.confirm(`Remove this ${FEATURE_TYPE_LABEL[f.feature_type]}${f.label ? ` (${f.label})` : ""}?`)) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("zone_features").delete().eq("id", f.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setFeatures((prev) => prev.filter((x) => x.id !== f.id));
    flash(`✓ Removed ${FEATURE_TYPE_LABEL[f.feature_type]}`);
  }

  function exportZoneWord() {
    const vendorNameById = Object.fromEntries(vendors.map((v) => [v.id, v.business_name]));
    const eventName = events.find((e) => e.id === eventId)?.name ?? "Event";
    const boothRows = booths
      .map(
        (b) =>
          `<tr><td>${b.booth_number ?? b.label}</td><td>${b.tier}</td><td>${b.status}</td><td>${
            b.vendor_id ? (vendorNameById[b.vendor_id] ?? "Unknown vendor") : "—"
          }</td><td>${b.lat != null ? `${b.lat.toFixed(5)}, ${b.lng!.toFixed(5)}` : `${b.width ?? 8}% × ${b.height ?? 8}%`}</td></tr>`,
      )
      .join("");
    const boundaryRows = boundaries
      .map(
        (bd) =>
          `<tr><td>${bd.boundary_type.replace("_", " ")}</td><td>${bd.label ?? "—"}</td><td>${
            bd.points_geo?.length ?? bd.points.length
          } points</td></tr>`,
      )
      .join("");
    const featureRows = features
      .map((f) => `<tr><td>${FEATURE_TYPE_LABEL[f.feature_type]}</td><td>${f.label ?? "—"}</td><td>${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}</td></tr>`)
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${eventName} — Zone Inventory</title></head>
<body>
<h1>${eventName} — Event Zone Inventory</h1>
<p>Generated ${new Date().toLocaleString("en-US")}</p>
<h2>Booths (${booths.length})</h2>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<thead><tr><th>Booth #</th><th>Tier</th><th>Status</th><th>Vendor</th><th>Position</th></tr></thead>
<tbody>${boothRows}</tbody>
</table>
<h2>Boundaries (${boundaries.length})</h2>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<thead><tr><th>Type</th><th>Label</th><th>Points</th></tr></thead>
<tbody>${boundaryRows}</tbody>
</table>
${
  features.length > 0
    ? `<h2>Infrastructure (${features.length})</h2>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<thead><tr><th>Type</th><th>Label</th><th>Position</th></tr></thead>
<tbody>${featureRows}</tbody>
</table>`
    : ""
}
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-zone-inventory.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading") {
    return <div role="status" aria-live="polite" className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">Loading…</div>;
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
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Event Zone Studio</h1>
        <Link href="/admin/board" className="text-sm font-semibold text-slate-700 underline">
          Venue Board →
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        {dataMode === "geo"
          ? "Trace the real event boundary on the map, then place booths, stages, and infrastructure inside it."
          : "Tap a booth to cycle Open → Reserved → Occupied. Add fences, gates, exits, and vendor areas below."}
      </p>

      {zonedEvents.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
          <p className="text-sm font-bold text-slate-900">Existing Event Zones ({zonedEvents.length})</p>
          <p className="mt-0.5 text-xs text-slate-500">Events with a traced boundary already — jump straight into editing one.</p>
          <div className="mt-3 space-y-1.5">
            {zonedEvents.map((e) => (
              <div
                key={e.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                  e.id === eventId ? "border-indigo-300 bg-indigo-50" : "border-slate-200"
                }`}
              >
                <span className="text-sm text-slate-800">
                  {TIMING_LABEL[timingOfEvent(e, todayKey)]} — <span className="font-semibold">{e.name}</span>
                  {e.event_date ? ` — ${e.event_date}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setEventId(e.id)}
                  className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  ✏️ Edit Zone
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 print:hidden">
        <label className="block text-sm font-medium text-slate-700">Event</label>
        <input
          type="text"
          value={eventSearch}
          onChange={(e) => setEventSearch(e.target.value)}
          placeholder="Search events by name…"
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {events.length === 0 && <option value="">No events yet — create one in Venue Board</option>}
            {events.length > 0 && groupedEventsByCity.length === 0 && <option value="">No events match &quot;{eventSearch}&quot;</option>}
            {groupedEventsByCity.map(([city, cityEvents]) => (
              <optgroup key={city} label={city}>
                {cityEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {TIMING_LABEL[timingOfEvent(event, todayKey)]} — {event.name}
                    {event.event_date ? ` — ${event.event_date}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {eventId && (
            <>
              <button
                type="button"
                onClick={exportZoneWord}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                📄 Export Word
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                🖨️ Print
              </button>
              {dataMode === "geo" && (
                <button
                  type="button"
                  onClick={() => setPreviewPublic((v) => !v)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    previewPublic ? "bg-slate-900 text-white" : "border border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                  }`}
                >
                  {previewPublic ? "✓ Previewing as Public" : "👁 Preview as Public"}
                </button>
              )}
            </>
          )}
        </div>
        {dataMode === "legacy" && (
          <p className="mt-2 text-xs text-amber-700">
            This event has an existing grid-based layout from before real-map tracing. It keeps working exactly as
            before here. (Real-map tracing is available for every event that doesn&apos;t have one of these yet.)
          </p>
        )}
      </div>

      {eventId && !loadingZone && booths.length === 0 && boundaries.length === 0 && events.length > 1 && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 print:hidden">
          <div>
            <label className="block text-xs font-medium text-indigo-900">
              🔁 Repeat a past event&apos;s zone layout here
            </label>
            <select
              value={copyFromEventId}
              onChange={(e) => setCopyFromEventId(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-indigo-300 px-3 py-2 text-sm"
            >
              <option value="">Choose a past event to copy from…</option>
              {events
                .filter((e) => e.id !== eventId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.event_date ? ` — ${e.event_date}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!copyFromEventId || copying}
            onClick={copyZoneLayout}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {copying ? "Copying…" : "Copy Zone Layout"}
          </button>
          <p className="w-full text-xs text-indigo-700">
            Copies every booth and boundary shape as-is — vendor claims and booth statuses reset to Open since
            this is a new occurrence.
          </p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {toast && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{toast}</p>}

      {dataMode === "geo" ? (
        <>
          {/* Controls render above the map on purpose - on a phone-height
             screen, the page's header/search/event-picker above already
             fills the viewport, so a "Save"/"Finish Boundary" button placed
             below the 520px map was effectively unreachable without a long
             scroll and looked like it didn't exist. Keeping controls
             immediately above the map means one scroll gets you to both. */}
          {!previewPublic && eventId && !loadingZone && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
              {zoneUiMode === "draw-boundary" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-indigo-700">
                    ✏️ Tracing boundary — click the map to place corners ({drawnGeoPoints.length} placed)
                  </span>
                  <button
                    type="button"
                    disabled={drawnGeoPoints.length === 0}
                    onClick={undoLastGeoPoint}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    ↶ Undo Last
                  </button>
                  <button
                    type="button"
                    disabled={drawnGeoPoints.length === 0}
                    onClick={() => setDrawnGeoPoints([])}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={drawnGeoPoints.length < 3}
                    onClick={finishTraceBoundary}
                    className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    ✓ Finish Boundary
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoneUiMode("view");
                      setDrawnGeoPoints([]);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : eventBoundary ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">✓ Event boundary traced ({eventBoundary.points_geo?.length ?? 0} points)</span>
                  <button
                    type="button"
                    onClick={editEventBoundary}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit Boundary
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startTraceBoundary}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  ✏️ Trace Event Boundary
                </button>
              )}

              {eventBoundary && zoneUiMode !== "draw-boundary" && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-700">Place inside the boundary</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PLACEABLE_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => startPlacing(t)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          placingType === t
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {t === "booth" ? "🏪 Booth" : FEATURE_TYPE_LABEL[t]}
                      </button>
                    ))}
                    {zoneUiMode === "place-features" && (
                      <button
                        type="button"
                        onClick={stopPlacing}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:underline"
                      >
                        Done Placing
                      </button>
                    )}
                  </div>
                  {zoneUiMode === "place-features" && !pendingPlacement && (
                    <p className={`mt-2 text-xs ${placementHint ? "font-semibold text-red-600" : "text-slate-500"}`} role={placementHint ? "alert" : undefined}>
                      {placementHint ?? `Click inside the shaded boundary to place a ${placingType}.`}
                    </p>
                  )}
                  {pendingPlacement && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2">
                      <input
                        type="text"
                        placeholder={placingType === "booth" ? "Booth label (optional)" : "Label (optional)"}
                        value={placingLabel}
                        onChange={(e) => setPlacingLabel(e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={savePendingPlacement}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPlacement(null);
                          setPlacingLabel("");
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            {loadingZone && <p className="text-sm text-slate-500">Loading zone map…</p>}
            {!loadingZone && eventId && (
              <ZoneMapLeaflet
                mode={zoneMapMode}
                center={mapCenter}
                boundaries={geoBoundaries}
                booths={geoBooths}
                features={features}
                contextPins={contextPins}
                onBoothClick={handleBoothClick}
                drawnPoints={drawnGeoPoints}
                onDrawPoint={(p) => setDrawnGeoPoints((prev) => [...prev, p])}
                placingType={placingType}
                onPlacePoint={handleGeoPlacePoint}
                onPlaceRejected={handleGeoPlaceRejected}
              />
            )}
          </div>

          {geoBooths.length > 0 && (
            <div className="mt-3 space-y-1">
              {geoBooths.map((b) => (
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

          {features.length > 0 && !previewPublic && (
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {features.map((f) =>
                editingFeatureId === f.id ? (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <strong>{FEATURE_TYPE_LABEL[f.feature_type]}</strong>
                    <input
                      type="text"
                      value={editingFeatureLabel}
                      onChange={(e) => setEditingFeatureLabel(e.target.value)}
                      placeholder="Label (optional)"
                      autoFocus
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => saveFeatureLabel(f)}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingFeatureId(null)} className="text-xs font-semibold text-slate-500 hover:underline">
                      Cancel
                    </button>
                  </li>
                ) : (
                  <li key={f.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span>
                      <strong>{FEATURE_TYPE_LABEL[f.feature_type]}</strong>
                      {f.label ? ` — ${f.label}` : ""}
                    </span>
                    <span className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFeatureId(f.id);
                          setEditingFeatureLabel(f.label ?? "");
                        }}
                        className="text-xs font-semibold text-indigo-600 underline"
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteFeature(f)} className="text-xs font-semibold text-red-600 underline">
                        Remove
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      ) : (
        <>
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
            <form onSubmit={addBoundary} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-end gap-2">
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
                <button
                  type="button"
                  onClick={() => setDrawMode((v) => !v)}
                  className="rounded-full border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  {drawMode ? "Switch to typing coordinates" : "✏️ Switch to drawing on map"}
                </button>
                <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                  Add Boundary
                </button>
              </div>

              {drawMode ? (
                <ZoneBoundaryDrawer
                  booths={booths}
                  existingBoundaries={boundaries}
                  points={drawnPoints}
                  onChange={setDrawnPoints}
                />
              ) : (
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
              )}
            </form>
          )}

          {boundaries.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {boundaries.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span>
                    <strong className="capitalize">{b.boundary_type.replace("_", " ")}</strong>
                    {b.label ? ` — ${b.label}` : ""} ({b.points_geo?.length ?? b.points.length} points)
                  </span>
                  <button type="button" onClick={() => deleteBoundary(b)} className="text-xs font-semibold text-red-600 underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
