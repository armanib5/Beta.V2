"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CITY_CENTERS } from "@/lib/geo";
import { BASE_PATH } from "@/lib/site";

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

declare global {
  interface Window {
    L?: typeof import("leaflet");
  }
}

/** Loads the same vendored Leaflet build the public map already uses
 * (public/map/vendor/leaflet/*) instead of adding a second copy of the
 * same library as an npm dependency. */
function loadLeaflet(): Promise<NonNullable<Window["L"]>> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${BASE_PATH}/map/vendor/leaflet/leaflet.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${BASE_PATH}/map/vendor/leaflet/leaflet.js`;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet failed to load")));
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
}

export function MapStudio({ initialPins }: { initialPins: PinRow[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [pins, setPins] = useState(initialPins);
  // Marker click handlers are bound once, when a marker is first created
  // (see the pins-sync effect below) - they close over whatever
  // `selectPin` looked like at that moment, which itself closed over
  // that render's `pins`. Without this ref, clicking an existing pin
  // after any OTHER pin had been edited would show stale data, since the
  // handler's captured `pins` snapshot never gets updated. Read through
  // this ref instead of the `pins` state variable anywhere a marker
  // callback (created once) needs the current list (updated every time).
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

  const selected = pins.find((p) => p.id === selectedId) ?? null;

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
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
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
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    function onMapClick(e: import("leaflet").LeafletMouseEvent) {
      if (!addMode) return;
      createPinAt(e.latlng.lat, e.latlng.lng);
    }
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, addMode]);

  // Keep markers in sync with `pins` - add/remove/reposition, not a full
  // teardown-and-rebuild, so an in-progress drag never gets interrupted
  // by the same pin's own state update.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;

    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      let marker = markersRef.current.get(pin.id);
      if (!marker) {
        marker = L.marker([pin.lat, pin.lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const pos = marker!.getLatLng();
          savePin(pin.id, { lat: pos.lat, lng: pos.lng });
        });
        marker.on("click", () => selectPin(pin.id));
        markersRef.current.set(pin.id, marker);
      } else {
        marker.setLatLng([pin.lat, pin.lng]);
      }
      marker.setOpacity(pin.status === "approved" ? 1 : 0.4);
      marker.bindTooltip(pin.title || "Untitled pin", { permanent: false });
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapReady]);

  function selectPin(id: string) {
    const pin = pinsRef.current.find((p) => p.id === id);
    if (!pin) return;
    setSelectedId(id);
    setForm({ title: pin.title ?? "", description: pin.description ?? "", category: pin.category ?? "business" });
    setError(null);
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAddMode((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            addMode ? "bg-slate-900 text-white" : "border border-slate-400 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {addMode ? "📍 Click the map to place a pin…" : "+ Add Pin"}
        </button>
        <a
          href={`${BASE_PATH}/map/`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          👁 Preview Public Map ↗
        </a>
        {saving && <span className="text-xs text-slate-500">Saving…</span>}
        {toast && <span className="text-xs font-semibold text-green-700">{toast}</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={mapDivRef} className="h-[520px] w-full rounded-xl border border-slate-300" />

        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
          {!selected || !form ? (
            <p className="text-sm text-slate-500">
              Click a pin on the map to edit it, or click <strong>+ Add Pin</strong> then click anywhere on the map to
              place a new one.
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
