"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CITY_CENTERS } from "@/lib/geo";
import { BASE_PATH } from "@/lib/site";
import { loadLeaflet, TILE_LAYER_URL, TILE_LAYER_ATTRIBUTION, TILE_LAYER_MAX_ZOOM } from "@/lib/map/leaflet-loader";
import { entityDivIcon, syncEditableLayer, syncCircleZoneLayer, type MapDraft } from "@/lib/map/leaflet-shared";
import type { PublicNotice, NoticeStatus } from "@/lib/types";

/** The `pins` table's `category` column has a check constraint of its
 * own, separate from (and much narrower than) the map's visual icon
 * vocabulary in public/map/data/places.js's CATS - confirmed live
 * against the actual constraint rather than assumed, since guessing
 * wrong here would silently reject every save. See PINS_CATEGORY_TO_MAP_CAT
 * in map.js for how each of these renders as an icon on the public map. */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "food", label: "Food & Drink" },
  { value: "event", label: "Event" },
];

type PinRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  status: string;
  lat: number;
  lng: number;
  vendor_id: string | null;
  event_id: string | null;
};

type VendorRow = {
  id: string;
  business_name: string;
  lat: number;
  lng: number;
  status: string;
  category_names: string[];
  location_verified_at: string | null;
};

type EventRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  location: string | null;
  category_name: string | null;
  location_verified_at: string | null;
};

type Draft = MapDraft;
type DraftSetter = React.Dispatch<React.SetStateAction<Record<string, Draft>>>;

const VENDOR_COLOR = "#4338ca"; // indigo
const EVENT_COLOR = "#0f766e"; // teal
const DIRTY_COLOR = "#d97706"; // amber - staged, unsaved drag

function stageDraft(setDrafts: DraftSetter, id: string, lat: number, lng: number) {
  setDrafts((prev) => ({ ...prev, [id]: { lat, lng } }));
}

function clearDraft(setDrafts: DraftSetter, id: string) {
  setDrafts((prev) => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
}

const NOTICE_TODAY = () => new Date().toISOString().slice(0, 10);

/** Display-only "has this zone's end date passed" check - deliberately not
 * a DB write/cron job. A notice's stored `status` only ever changes when an
 * admin explicitly sets it; an expired-but-still-"active" row just stops
 * rendering as a live warning once its end_date is in the past. */
function isNoticeExpired(notice: PublicNotice): boolean {
  return !!notice.end_date && notice.end_date < NOTICE_TODAY();
}

export function MapStudio({
  initialPins,
  initialVendors = [],
  initialEvents = [],
  initialNotices = [],
}: {
  initialPins: PinRow[];
  initialVendors?: VendorRow[];
  initialEvents?: EventRow[];
  initialNotices?: PublicNotice[];
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const vendorMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const eventMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const noticeMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const noticeCirclesRef = useRef<Map<string, import("leaflet").Circle>>(new Map());
  const [pins, setPins] = useState(initialPins);
  // Marker click/dragend handlers are bound once, when a marker is first
  // created (see the sync effects below) - by design they only ever close
  // over a stable id, never the entity itself, but the id lookups those
  // handlers trigger (selectPin/selectVendor/selectEvent) still need
  // somewhere to read *current* data from. Without these refs, selecting
  // an entity after any OTHER one in the same layer had been edited would
  // show stale data, since a plain state variable read inside a
  // once-bound closure never sees later renders.
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  const [mapReady, setMapReady] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; category: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showPins, setShowPins] = useState(true);
  const [showVendors, setShowVendors] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showNotices, setShowNotices] = useState(true);

  const [vendors, setVendors] = useState(initialVendors);
  const vendorsRef = useRef(vendors);
  useEffect(() => {
    vendorsRef.current = vendors;
  }, [vendors]);
  // A vendor/event marker drag never calls the API directly (unlike a pin
  // drag) - it only stages a candidate position here, keyed by id, so a
  // location fix is never persisted without an explicit Save click. See
  // the requirement this was built for: "every location correction
  // intentional and visually verified," since most vendor coordinates
  // were never placed on a map at all (set from a phone's raw GPS at
  // signup) and a silent auto-save here would just replace one unverified
  // number with another.
  const [vendorDrafts, setVendorDrafts] = useState<Record<string, Draft>>({});
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const [events, setEvents] = useState(initialEvents);
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  const [eventDrafts, setEventDrafts] = useState<Record<string, Draft>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Danger Zones save position immediately on drag (like Pins) rather than
  // staging a draft (like Vendors/Events) - there's no "unverified GPS from
  // signup" to double-check here, it's a shape an admin is drawing fresh.
  const [notices, setNotices] = useState(initialNotices);
  const noticesRef = useRef(notices);
  useEffect(() => {
    noticesRef.current = notices;
  }, [notices]);
  const [addNoticeMode, setAddNoticeMode] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [noticeForm, setNoticeForm] = useState<{
    title: string;
    description: string;
    status: NoticeStatus;
    radius_meters: string;
    start_date: string;
    end_date: string;
  } | null>(null);

  const selected = pins.find((p) => p.id === selectedId) ?? null;
  const selectedNotice = notices.find((n) => n.id === selectedNoticeId) ?? null;
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? null;
  const selectedVendorDraft = selectedVendorId ? vendorDrafts[selectedVendorId] : undefined;
  const unsavedVendorCount = Object.keys(vendorDrafts).length;
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;
  const selectedEventDraft = selectedEventId ? eventDrafts[selectedEventId] : undefined;
  const unsavedEventCount = Object.keys(eventDrafts).length;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  // Map init - once, imperative (Leaflet owns the DOM node directly, same
  // as the public map page does; React only owns the wrapping div).
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        const center = CITY_CENTERS[0];
        const map = L.map(mapDivRef.current).setView([center.lat, center.lng], 13);
        L.tileLayer(TILE_LAYER_URL, { attribution: TILE_LAYER_ATTRIBUTION, maxZoom: TILE_LAYER_MAX_ZOOM }).addTo(map);
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => setError("Couldn't load the map. Try reloading the page."));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Click-to-add - a separate effect (not inline in the init effect) so
  // toggling Add Pin mode doesn't have to tear down and rebuild the map.
  // Pins and Danger Zones are the only things ever created here - vendors/
  // events already exist from signup/board submissions, so their layers
  // are correction-only.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    function onMapClick(e: import("leaflet").LeafletMouseEvent) {
      if (addMode) createPinAt(e.latlng.lat, e.latlng.lng);
      else if (addNoticeMode) createNoticeAt(e.latlng.lat, e.latlng.lng);
    }
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, addMode, addNoticeMode]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncEditableLayer({
      L,
      map,
      markersRef,
      entities: pins,
      drafts: {},
      show: showPins,
      opacity: (pin) => (pin.status === "approved" ? 1 : 0.4),
      tooltip: (pin) => pin.title || "Untitled pin",
      onDragEnd: (id, lat, lng) => savePin(id, { lat, lng }),
      onClick: (id) => selectPin(id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapReady, showPins]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncEditableLayer({
      L,
      map,
      markersRef: vendorMarkersRef,
      entities: vendors,
      drafts: vendorDrafts,
      show: showVendors,
      icon: (v, isDirty) =>
        entityDivIcon(L, {
          id: v.id,
          emoji: "\u{1F3EA}",
          color: isDirty ? DIRTY_COLOR : VENDOR_COLOR,
          needsReview: !isDirty && !v.location_verified_at,
        }),
      tooltip: (v, isDirty) =>
        v.business_name + (isDirty ? " (unsaved)" : v.location_verified_at ? "" : " (needs review)"),
      onDragEnd: (id, lat, lng) => stageDraft(setVendorDrafts, id, lat, lng),
      onClick: (id) => selectVendor(id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, vendorDrafts, mapReady, showVendors]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncEditableLayer({
      L,
      map,
      markersRef: eventMarkersRef,
      entities: events,
      drafts: eventDrafts,
      show: showEvents,
      icon: (e, isDirty) =>
        entityDivIcon(L, {
          id: e.id,
          emoji: "\u{1F3AA}",
          color: isDirty ? DIRTY_COLOR : EVENT_COLOR,
          needsReview: !isDirty && !e.location_verified_at,
        }),
      tooltip: (e, isDirty) => e.name + (isDirty ? " (unsaved)" : e.location_verified_at ? "" : " (needs review)"),
      onDragEnd: (id, lat, lng) => stageDraft(setEventDrafts, id, lat, lng),
      onClick: (id) => selectEvent(id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, eventDrafts, mapReady, showEvents]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncCircleZoneLayer({
      L,
      map,
      markersRef: noticeMarkersRef,
      circlesRef: noticeCirclesRef,
      entities: notices,
      drafts: {},
      show: showNotices,
      style: (n) => {
        const live = n.status === "active" && !isNoticeExpired(n);
        return live
          ? { color: "#dc2626", weight: 2, fillColor: "#dc2626", fillOpacity: 0.25 }
          : { color: "#6b7280", weight: 1.5, fillColor: "#6b7280", fillOpacity: 0.12, dashArray: "4,3" };
      },
      tooltip: (n) => `🚫 ${n.title}${n.status === "resolved" ? " (resolved)" : isNoticeExpired(n) ? " (expired)" : ""}`,
      onDragEnd: (id, lat, lng) => saveNoticePosition(id, lat, lng),
      onClick: (id) => selectNotice(id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices, mapReady, showNotices]);

  function selectPin(id: string) {
    const pin = pinsRef.current.find((p) => p.id === id);
    if (!pin) return;
    setSelectedId(id);
    setForm({ title: pin.title ?? "", description: pin.description ?? "", category: pin.category ?? "business" });
    setSelectedVendorId(null);
    setSelectedEventId(null);
    setSelectedNoticeId(null);
    setNoticeForm(null);
    setError(null);
  }

  function selectVendor(id: string) {
    const vendor = vendorsRef.current.find((v) => v.id === id);
    if (!vendor) return;
    setSelectedVendorId(id);
    setSelectedId(null);
    setForm(null);
    setSelectedEventId(null);
    setSelectedNoticeId(null);
    setNoticeForm(null);
    setError(null);
  }

  function selectEvent(id: string) {
    const event = eventsRef.current.find((e) => e.id === id);
    if (!event) return;
    setSelectedEventId(id);
    setSelectedId(null);
    setForm(null);
    setSelectedVendorId(null);
    setSelectedNoticeId(null);
    setNoticeForm(null);
    setError(null);
  }

  function selectNotice(id: string) {
    const notice = noticesRef.current.find((n) => n.id === id);
    if (!notice) return;
    setSelectedNoticeId(id);
    setNoticeForm({
      title: notice.title,
      description: notice.description ?? "",
      status: notice.status,
      radius_meters: String(notice.radius_meters),
      start_date: notice.start_date,
      end_date: notice.end_date ?? "",
    });
    setSelectedId(null);
    setForm(null);
    setSelectedVendorId(null);
    setSelectedEventId(null);
    setError(null);
  }

  async function saveVendorLocation(id: string) {
    const draft = vendorDrafts[id];
    if (!draft) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("vendors")
      .update({ lat: draft.lat, lng: draft.lng, location_verified_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,business_name,lat,lng,location_verified_at")
      .single<{ id: string; business_name: string; lat: number; lng: number; location_verified_at: string | null }>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not save this vendor's location.");
      return;
    }
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, lat: data.lat, lng: data.lng, location_verified_at: data.location_verified_at } : v,
      ),
    );
    clearDraft(setVendorDrafts, id);
    flash(`✓ Location saved — ${data.business_name}`);
  }

  function cancelVendorEdit(id: string) {
    clearDraft(setVendorDrafts, id);
    setSelectedVendorId(null);
  }

  async function markVendorVerified(id: string) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("vendors")
      .update({ location_verified_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,business_name,location_verified_at")
      .single<{ id: string; business_name: string; location_verified_at: string | null }>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not mark this vendor as verified.");
      return;
    }
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, location_verified_at: data.location_verified_at } : v)));
    flash(`✓ Marked verified — ${data.business_name}`);
  }

  async function saveEventLocation(id: string) {
    const draft = eventDrafts[id];
    if (!draft) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("lov_entries")
      .update({ lat: draft.lat, lng: draft.lng, location_verified_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,name,lat,lng,location_verified_at")
      .single<{ id: string; name: string; lat: number; lng: number; location_verified_at: string | null }>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not save this event's location.");
      return;
    }
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, lat: data.lat, lng: data.lng, location_verified_at: data.location_verified_at } : e,
      ),
    );
    clearDraft(setEventDrafts, id);
    flash(`✓ Location saved — ${data.name}`);
  }

  function cancelEventEdit(id: string) {
    clearDraft(setEventDrafts, id);
    setSelectedEventId(null);
  }

  async function markEventVerified(id: string) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("lov_entries")
      .update({ location_verified_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,name,location_verified_at")
      .single<{ id: string; name: string; location_verified_at: string | null }>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not mark this event as verified.");
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, location_verified_at: data.location_verified_at } : e)));
    flash(`✓ Marked verified — ${data.name}`);
  }

  async function createPinAt(lat: number, lng: number) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("pins")
      .insert({ title: "New Pin", category: "business", status: "approved", lat, lng })
      .select("*")
      .single<PinRow>();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not add pin.");
      return;
    }
    setPins((prev) => [...prev, data]);
    setAddMode(false);
    // Set the edit panel directly from the freshly-inserted row instead of
    // routing through selectPin(data.id) - selectPin looks the pin up by id
    // in the pins list, and immediately after this setPins call that lookup
    // would still miss the new pin (state updates aren't synchronous), so
    // the panel would silently never open.
    setSelectedId(data.id);
    setForm({ title: data.title ?? "", description: data.description ?? "", category: data.category ?? "business" });
    setSelectedVendorId(null);
    setSelectedEventId(null);
    setSelectedNoticeId(null);
    setNoticeForm(null);
    setError(null);
    flash("✓ Pin added — edit its details below");
  }

  async function savePin(id: string, patch: Partial<PinRow>): Promise<boolean> {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase.from("pins").update(patch).eq("id", id).select("*").single<PinRow>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not save changes.");
      return false;
    }
    setPins((prev) => prev.map((p) => (p.id === id ? data : p)));
    return true;
  }

  async function saveForm() {
    if (!selected || !form) return;
    if (!form.title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    const ok = await savePin(selected.id, {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
    });
    if (ok) flash(`✓ Saved — ${form.title.trim()}`);
  }

  // pins.status only allows "pending" or "approved" (confirmed live against
  // the actual check constraint - there's no third "rejected"/"inactive"
  // value, unlike what the legacy admin panel's Reject button assumes).
  // "pending" is what keeps a pin off the public map, so that's what
  // Deactivate sets.
  async function toggleActive() {
    if (!selected) return;
    await savePin(selected.id, { status: selected.status === "approved" ? "pending" : "approved" });
  }

  async function deletePin() {
    if (!selected) return;
    if (!window.confirm(`Permanently remove "${selected.title || "this pin"}" from the map?`)) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("pins").delete().eq("id", selected.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setPins((prev) => prev.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    setForm(null);
    flash("✓ Pin removed");
  }

  function formatVerifiedAt(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  async function createNoticeAt(lat: number, lng: number) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("public_notices")
      .insert({ title: "New Danger Zone", status: "active", radius_meters: 50, start_date: NOTICE_TODAY(), lat, lng })
      .select("*")
      .single<PublicNotice>();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not add zone.");
      return;
    }
    setNotices((prev) => [...prev, data]);
    setAddNoticeMode(false);
    selectNoticeFromRow(data);
    flash("✓ Zone added — set its details below");
  }

  // Mirrors selectNotice, but reads from a just-inserted row directly
  // instead of looking it up in `notices` state - see createPinAt's
  // identical comment for why (setNotices hasn't flushed yet here).
  function selectNoticeFromRow(notice: PublicNotice) {
    setSelectedNoticeId(notice.id);
    setNoticeForm({
      title: notice.title,
      description: notice.description ?? "",
      status: notice.status,
      radius_meters: String(notice.radius_meters),
      start_date: notice.start_date,
      end_date: notice.end_date ?? "",
    });
    setSelectedId(null);
    setForm(null);
    setSelectedVendorId(null);
    setSelectedEventId(null);
    setError(null);
  }

  async function saveNoticePosition(id: string, lat: number, lng: number) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("public_notices")
      .update({ lat, lng })
      .eq("id", id)
      .select("*")
      .single<PublicNotice>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not move this zone.");
      return;
    }
    setNotices((prev) => prev.map((n) => (n.id === id ? data : n)));
  }

  async function saveNoticeForm() {
    if (!selectedNotice || !noticeForm) return;
    if (!noticeForm.title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    const radius = Number(noticeForm.radius_meters);
    if (!Number.isFinite(radius) || radius <= 0) {
      setError("Radius must be a positive number.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("public_notices")
      .update({
        title: noticeForm.title.trim(),
        description: noticeForm.description.trim() || null,
        status: noticeForm.status,
        radius_meters: radius,
        start_date: noticeForm.start_date,
        end_date: noticeForm.end_date || null,
      })
      .eq("id", selectedNotice.id)
      .select("*")
      .single<PublicNotice>();
    setSaving(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not save this zone.");
      return;
    }
    setNotices((prev) => prev.map((n) => (n.id === data.id ? data : n)));
    flash(`✓ Saved — ${data.title}`);
  }

  async function deleteNotice() {
    if (!selectedNotice) return;
    if (!window.confirm(`Permanently remove "${selectedNotice.title}" from the map?`)) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("public_notices").delete().eq("id", selectedNotice.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setNotices((prev) => prev.filter((n) => n.id !== selectedNotice.id));
    setSelectedNoticeId(null);
    setNoticeForm(null);
    flash("✓ Zone removed");
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setAddNoticeMode(false);
            setAddMode((v) => !v);
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            addMode ? "bg-slate-900 text-white" : "border border-slate-400 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {addMode ? "📍 Click the map to place a pin…" : "+ Add Pin"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAddMode(false);
            setAddNoticeMode((v) => !v);
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            addNoticeMode ? "bg-red-600 text-white" : "border border-red-400 text-red-700 hover:bg-red-50"
          }`}
        >
          {addNoticeMode ? "🚫 Click the map to place a zone…" : "+ Add Danger Zone"}
        </button>
        <a
          href={`${BASE_PATH}/map/`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          👁 Preview Public Map ↗
        </a>
        <span className="mx-1 h-6 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => setShowPins((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            showPins ? "border border-slate-400 text-slate-700 hover:bg-slate-50" : "border border-slate-200 text-slate-400"
          }`}
        >
          📍 Pins {showPins ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => setShowVendors((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            showVendors ? "border border-indigo-400 text-indigo-700 hover:bg-indigo-50" : "border border-slate-200 text-slate-400"
          }`}
        >
          🏪 Vendors {showVendors ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => setShowEvents((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            showEvents ? "border border-teal-400 text-teal-700 hover:bg-teal-50" : "border border-slate-200 text-slate-400"
          }`}
        >
          🎪 Events {showEvents ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={() => setShowNotices((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            showNotices ? "border border-red-400 text-red-700 hover:bg-red-50" : "border border-slate-200 text-slate-400"
          }`}
        >
          🚫 Danger Zones {showNotices ? "on" : "off"}
        </button>
        <button
          type="button"
          disabled
          title="Booths are managed on the Event Zone Map today - this layer is reserved for when that moves into Map Studio."
          className="cursor-not-allowed rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-300"
        >
          🏗 Booths (soon)
        </button>
        {unsavedVendorCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {unsavedVendorCount} vendor location{unsavedVendorCount === 1 ? "" : "s"} unsaved
          </span>
        )}
        {unsavedEventCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {unsavedEventCount} event location{unsavedEventCount === 1 ? "" : "s"} unsaved
          </span>
        )}
        {saving && <span className="text-xs text-slate-500">Saving…</span>}
        {toast && <span className="text-xs font-semibold text-green-700">{toast}</span>}
      </div>

      {/* order-* below puts the selected-pin editor panel (with its Save
         buttons) ABOVE the map on a phone-height screen instead of below
         a 520px map - same fix already applied to admin/zones (commit
         01092ed) for the same reason: a Save button pushed below a tall
         fixed-height map was effectively unreachable without a long
         scroll. lg:order-none restores natural DOM order (map left,
         panel right) once the grid actually has two columns. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={mapDivRef} className="order-2 h-[520px] w-full rounded-xl border border-slate-300 lg:order-none" />

        <div className="order-1 rounded-xl border border-slate-300 bg-slate-50 p-4 lg:order-none">
          {selectedVendor ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    selectedVendorDraft
                      ? "bg-amber-100 text-amber-800"
                      : selectedVendor.location_verified_at
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  🏪{" "}
                  {selectedVendorDraft
                    ? "Unsaved location"
                    : selectedVendor.location_verified_at
                      ? "Verified"
                      : "⚠ Needs Location Review"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedVendorId(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Close
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Business Name</p>
                <p className="text-sm text-slate-900">{selectedVendor.business_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Category</p>
                <p className="text-sm text-slate-900">
                  {selectedVendor.category_names.length ? selectedVendor.category_names.join(", ") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Stored Coordinates</p>
                <p className="text-sm text-slate-900">
                  {selectedVendor.lat.toFixed(6)}, {selectedVendor.lng.toFixed(6)}
                </p>
              </div>
              {selectedVendor.location_verified_at && !selectedVendorDraft && (
                <p className="text-xs text-slate-500">Verified {formatVerifiedAt(selectedVendor.location_verified_at)}</p>
              )}
              {selectedVendorDraft && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-800">Pending Coordinates (not yet saved)</p>
                  <p className="text-sm text-amber-900">
                    {selectedVendorDraft.lat.toFixed(6)}, {selectedVendorDraft.lng.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Drag the marker again to adjust, or Save to confirm this is the correct building.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Drag this vendor&apos;s marker on the map to its correct physical building, then Save. No address is
                on file for vendors yet, so the map is the only way to check this today.
              </p>
              {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => saveVendorLocation(selectedVendor.id)}
                  disabled={saving || !selectedVendorDraft}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => cancelVendorEdit(selectedVendor.id)}
                  disabled={saving || !selectedVendorDraft}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => markVendorVerified(selectedVendor.id)}
                  disabled={saving || !!selectedVendorDraft || !!selectedVendor.location_verified_at}
                  className="rounded-full border border-green-400 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  {selectedVendor.location_verified_at ? "✓ Verified" : "✓ Mark as Verified"}
                </button>
              </div>
            </div>
          ) : selectedEvent ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    selectedEventDraft
                      ? "bg-amber-100 text-amber-800"
                      : selectedEvent.location_verified_at
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  🎪{" "}
                  {selectedEventDraft
                    ? "Unsaved location"
                    : selectedEvent.location_verified_at
                      ? "Verified"
                      : "⚠ Needs Location Review"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Close
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Event Name</p>
                <p className="text-sm text-slate-900">{selectedEvent.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Category</p>
                <p className="text-sm text-slate-900">{selectedEvent.category_name ?? "—"}</p>
              </div>
              {selectedEvent.location && (
                <div>
                  <p className="text-xs font-semibold text-slate-600">Address</p>
                  <p className="text-sm text-slate-900">{selectedEvent.location}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-600">Stored Coordinates</p>
                <p className="text-sm text-slate-900">
                  {selectedEvent.lat.toFixed(6)}, {selectedEvent.lng.toFixed(6)}
                </p>
              </div>
              {selectedEvent.location_verified_at && !selectedEventDraft && (
                <p className="text-xs text-slate-500">Verified {formatVerifiedAt(selectedEvent.location_verified_at)}</p>
              )}
              {selectedEventDraft && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-800">Pending Coordinates (not yet saved)</p>
                  <p className="text-sm text-amber-900">
                    {selectedEventDraft.lat.toFixed(6)}, {selectedEventDraft.lng.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Drag the marker again to adjust, or Save to confirm this is the correct spot.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Drag this event&apos;s marker to its correct location, then Save. Events without their own lat/lng
                fall back to a coarse neighborhood or city-center point until corrected here.
              </p>
              {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => saveEventLocation(selectedEvent.id)}
                  disabled={saving || !selectedEventDraft}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => cancelEventEdit(selectedEvent.id)}
                  disabled={saving || !selectedEventDraft}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => markEventVerified(selectedEvent.id)}
                  disabled={saving || !!selectedEventDraft || !!selectedEvent.location_verified_at}
                  className="rounded-full border border-green-400 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  {selectedEvent.location_verified_at ? "✓ Verified" : "✓ Mark as Verified"}
                </button>
              </div>
            </div>
          ) : selectedNotice && noticeForm ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    noticeForm.status === "active" && !isNoticeExpired(selectedNotice)
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  🚫{" "}
                  {noticeForm.status === "resolved"
                    ? "Resolved"
                    : isNoticeExpired(selectedNotice)
                      ? "Expired"
                      : "Active"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNoticeId(null);
                    setNoticeForm(null);
                  }}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Close
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Title</label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm((f) => (f ? { ...f, title: e.target.value } : f))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <textarea
                  value={noticeForm.description}
                  onChange={(e) => setNoticeForm((f) => (f ? { ...f, description: e.target.value } : f))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={noticeForm.status}
                    onChange={(e) => setNoticeForm((f) => (f ? { ...f, status: e.target.value as NoticeStatus } : f))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Radius (meters)</label>
                  <input
                    type="number"
                    min={1}
                    value={noticeForm.radius_meters}
                    onChange={(e) => setNoticeForm((f) => (f ? { ...f, radius_meters: e.target.value } : f))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Start Date</label>
                  <input
                    type="date"
                    value={noticeForm.start_date}
                    onChange={(e) => setNoticeForm((f) => (f ? { ...f, start_date: e.target.value } : f))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">End Date (optional)</label>
                  <input
                    type="date"
                    value={noticeForm.end_date}
                    onChange={(e) => setNoticeForm((f) => (f ? { ...f, end_date: e.target.value } : f))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Drag the small white-and-red handle at the zone&apos;s center to reposition it — it saves
                immediately. Once End Date passes, the zone automatically stops showing as an active warning on the
                Public Map without needing to come back and resolve it manually.
              </p>
              {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveNoticeForm}
                  disabled={saving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={deleteNotice}
                  disabled={saving}
                  className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ) : !selected || !form ? (
            <p className="text-sm text-slate-500">
              Click a pin, vendor, event, or danger zone on the map to edit it, or click <strong>+ Add Pin</strong> /{" "}
              <strong>+ Add Danger Zone</strong> then click anywhere on the map to place a new one.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    selected.status === "approved" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {selected.status === "approved" ? "Active" : "Inactive"}
                </span>
                <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-slate-500 hover:underline">
                  Deselect
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => (f ? { ...f, description: e.target.value } : f))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => (f ? { ...f, category: e.target.value } : f))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                City is set automatically from where the pin sits on the map — drag it to move it into a different
                area instead of setting a city separately.
              </p>
              {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveForm}
                  disabled={saving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={saving}
                  className="rounded-full border border-amber-400 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  {selected.status === "approved" ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={deletePin}
                  disabled={saving}
                  className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
