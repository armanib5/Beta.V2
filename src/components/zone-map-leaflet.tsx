"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet, TILE_LAYER_URL, TILE_LAYER_ATTRIBUTION, TILE_LAYER_MAX_ZOOM } from "@/lib/map/leaflet-loader";
import { entityDivIcon, syncEditableLayer } from "@/lib/map/leaflet-shared";
import { pointInPolygon } from "@/lib/geo-polygon";
import type { Booth, ZoneBoundary, ZoneBoundaryGeoPoint, ZoneFeature, ZoneFeatureType } from "@/lib/types";

export type ZoneMapLeafletMode = "view" | "public" | "vendor-claim" | "draw-boundary" | "place-features";

export type PlacingType = ZoneFeatureType | "booth";

export interface ZoneMapContextPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  emoji: string;
}

const FEATURE_ICON: Record<ZoneFeatureType, string> = {
  stage: "\u{1F3A4}",
  seating: "\u{1FA91}",
  food: "\u{1F354}",
  bar: "\u{1F37A}",
  gate: "\u{1F6AA}",
  entrance: "\u{27A1}\u{FE0F}",
  exit: "\u{1F3C3}",
  info: "\u{2139}\u{FE0F}",
  restroom: "\u{1F6BB}",
};
const FEATURE_COLOR: Record<ZoneFeatureType, string> = {
  stage: "#7c3aed",
  seating: "#0891b2",
  food: "#ea580c",
  bar: "#b45309",
  gate: "#16a34a",
  entrance: "#16a34a",
  exit: "#dc2626",
  info: "#2563eb",
  restroom: "#475569",
};

export const FEATURE_TYPE_LABEL: Record<ZoneFeatureType, string> = {
  stage: "Stage",
  seating: "Seating",
  food: "Food",
  bar: "Bar",
  gate: "Gate (marker)",
  entrance: "Entrance",
  exit: "Exit (marker)",
  info: "Information Booth",
  restroom: "Restroom",
};

const BOOTH_STATUS_COLOR: Record<Booth["status"], string> = {
  open: "#16a34a",
  reserved: "#f59e0b",
  occupied: "#dc2626",
};

const BOUNDARY_LINE_COLOR: Record<string, string> = {
  event_boundary: "#dc2626",
  fence: "#64748b",
  gate: "#16a34a",
  exit: "#dc2626",
  vendor_area: "#2563eb",
  path: "#a16207",
};

interface ZoneMapLeafletProps {
  mode: ZoneMapLeafletMode;
  /** Only read on first mount - re-centering on every re-render would yank
   * the admin's pan/zoom position mid-edit. */
  center: { lat: number; lng: number };
  boundaries: ZoneBoundary[]; // geo-mode rows only (points_geo set)
  booths: Booth[]; // geo-mode rows only (lat/lng set)
  features: ZoneFeature[];
  contextPins?: ZoneMapContextPin[];
  currentVendorId?: string;
  onBoothClick?: (booth: Booth) => void;
  onFeatureClick?: (feature: ZoneFeature) => void;
  /** draw-boundary mode: vertices placed so far, and the callback fired on
   * every map click while in this mode. The page owns save/undo/clear. */
  drawnPoints?: ZoneBoundaryGeoPoint[];
  onDrawPoint?: (point: ZoneBoundaryGeoPoint) => void;
  /** place-features mode: which type is currently selected in the page's
   * palette. A click outside the event boundary is rejected client-side
   * (via onPlaceRejected) rather than silently doing nothing. */
  placingType?: PlacingType | null;
  onPlacePoint?: (point: { lat: number; lng: number }) => void;
  onPlaceRejected?: (reason: string) => void;
}

/** The Event Zone editor's real-map surface: one persistent Leaflet map
 * instance (not several components) since mounting/tearing down a Leaflet
 * map is expensive and would visibly jank pan/zoom if view/draw/place modes
 * each remounted their own map. Stays a dumb renderer + click-emitter, same
 * contract the old SVG <ZoneMap>/<ZoneBoundaryDrawer> had - no Supabase
 * calls in here, all form state and mutations stay in the page. */
export function ZoneMapLeaflet({
  mode,
  center,
  boundaries,
  booths,
  features,
  contextPins = [],
  currentVendorId,
  onBoothClick,
  onFeatureClick,
  drawnPoints = [],
  onDrawPoint,
  placingType,
  onPlacePoint,
  onPlaceRejected,
}: ZoneMapLeafletProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const boothMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const featureMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const contextMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const boundaryLayerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const drawLayerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);

  const centerRef = useRef(center);

  // Map init - once, imperative (Leaflet owns the DOM node directly, same
  // pattern as Map Studio and the public map page).
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        const map = L.map(mapDivRef.current).setView([centerRef.current.lat, centerRef.current.lng], 17);
        L.tileLayer(TILE_LAYER_URL, { attribution: TILE_LAYER_ATTRIBUTION, maxZoom: TILE_LAYER_MAX_ZOOM }).addTo(map);
        boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
        drawLayerGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Click handling for draw-boundary / place-features modes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    function onMapClick(e: import("leaflet").LeafletMouseEvent) {
      if (mode === "draw-boundary") {
        onDrawPoint?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        return;
      }
      if (mode === "place-features" && placingType) {
        const eventBoundary = boundaries.find(
          (b) => b.boundary_type === "event_boundary" && b.points_geo && b.points_geo.length >= 3,
        );
        if (eventBoundary?.points_geo) {
          const inside = pointInPolygon({ lat: e.latlng.lat, lng: e.latlng.lng }, eventBoundary.points_geo);
          if (!inside) {
            onPlaceRejected?.("Place inside the shaded event boundary.");
            return;
          }
        }
        onPlacePoint?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [mapReady, mode, placingType, boundaries, onDrawPoint, onPlacePoint, onPlaceRejected]);

  // Boundary polygons/polylines (saved boundaries).
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const group = boundaryLayerGroupRef.current;
    if (!L || !map || !mapReady || !group) return;
    group.clearLayers();
    for (const b of boundaries) {
      if (!b.points_geo || b.points_geo.length === 0) continue;
      const latlngs = b.points_geo.map((p) => [p.lat, p.lng] as [number, number]);
      const color = BOUNDARY_LINE_COLOR[b.boundary_type] ?? "#64748b";
      if (b.boundary_type === "event_boundary" || b.boundary_type === "vendor_area") {
        L.polygon(latlngs, { color, weight: 2, fillOpacity: 0.08, dashArray: b.boundary_type === "event_boundary" ? undefined : "6,4" })
          .bindTooltip(b.label || (b.boundary_type === "event_boundary" ? "Event Boundary" : "Vendor Area"))
          .addTo(group);
      } else {
        L.polyline(latlngs, { color, weight: 3, dashArray: b.boundary_type === "fence" ? "4,3" : undefined })
          .bindTooltip(b.label || b.boundary_type)
          .addTo(group);
      }
    }
     
  }, [boundaries, mapReady]);

  // In-progress boundary trace (draw-boundary mode only).
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const group = drawLayerGroupRef.current;
    if (!L || !map || !mapReady || !group) return;
    group.clearLayers();
    if (mode !== "draw-boundary" || drawnPoints.length === 0) return;
    const latlngs = drawnPoints.map((p) => [p.lat, p.lng] as [number, number]);
    if (drawnPoints.length > 1) {
      L.polygon(latlngs, { color: "#4f46e5", weight: 2, fillOpacity: 0.12, dashArray: "3,3" }).addTo(group);
    }
    drawnPoints.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: "#4f46e5", fillColor: "#fff", fillOpacity: 1, weight: 2 })
        .bindTooltip(String(i + 1), { permanent: true, direction: "top", offset: [0, -6] })
        .addTo(group);
    });
     
  }, [drawnPoints, mode, mapReady]);

  // Booths.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    const clickable = mode === "view" || mode === "public" || mode === "vendor-claim";
    syncEditableLayer({
      L,
      map,
      markersRef: boothMarkersRef,
      entities: booths.map((b) => ({ ...b, lat: b.lat ?? 0, lng: b.lng ?? 0 })),
      drafts: {},
      show: true,
      draggable: false,
      icon: (b) =>
        entityDivIcon(L, {
          id: b.id,
          emoji: String(b.booth_number ?? "#"),
          color: BOOTH_STATUS_COLOR[b.status],
          needsReview: false,
        }),
      tooltip: (b) =>
        `Booth ${b.booth_number ?? b.label} (${b.status})` + (mode === "vendor-claim" && b.vendor_id === currentVendorId ? " - yours" : ""),
      onClick: clickable ? (id) => onBoothClick?.(booths.find((b) => b.id === id)!) : () => {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booths, mapReady, mode, currentVendorId]);

  // Zone features (infrastructure).
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncEditableLayer({
      L,
      map,
      markersRef: featureMarkersRef,
      entities: features,
      drafts: {},
      show: true,
      draggable: false,
      icon: (f) =>
        entityDivIcon(L, { id: f.id, emoji: FEATURE_ICON[f.feature_type], color: FEATURE_COLOR[f.feature_type], needsReview: false }),
      tooltip: (f) => f.label || FEATURE_TYPE_LABEL[f.feature_type],
      onClick: mode === "view" ? (id) => onFeatureClick?.(features.find((f) => f.id === id)!) : () => {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, mapReady, mode]);

  // Read-only context pins (nearby vendors/events, for spatial reference
  // while tracing - dimmed, not clickable).
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    syncEditableLayer({
      L,
      map,
      markersRef: contextMarkersRef,
      entities: contextPins,
      drafts: {},
      show: true,
      draggable: false,
      icon: (p) => entityDivIcon(L, { id: p.id, emoji: p.emoji, color: "#94a3b8", needsReview: false }),
      opacity: () => 0.55,
      tooltip: (p) => p.label,
      onClick: () => {},
    });
     
  }, [contextPins, mapReady]);

  return (
    // The inner div's className must never change across re-renders: Leaflet
    // takes ownership of this exact DOM node and appends its own classes
    // (leaflet-container, leaflet-touch, etc.) imperatively, outside React's
    // bookkeeping. If React ever needs to update this node's className
    // (e.g. a reactive class based on `mode`), it overwrites the whole
    // attribute wholesale - silently wiping out every class Leaflet added,
    // which breaks the map's positioning system without actually destroying
    // it (markers go on rendering, just no longer anchored correctly). The
    // reactive cursor style lives on the wrapping div instead, which React
    // owns exclusively.
    <div className={mode === "draw-boundary" || mode === "place-features" ? "cursor-crosshair" : ""}>
      <div ref={mapDivRef} className="h-[520px] w-full rounded-xl border border-slate-300" />
    </div>
  );
}
