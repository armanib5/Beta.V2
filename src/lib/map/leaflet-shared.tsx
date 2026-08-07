/** Shared building blocks for every React Leaflet surface that renders
 * "editable entity" markers - Map Studio today, the Event Zone editor next.
 * Kept dependency-free of any one page's specific data shape (Pin/Vendor/
 * Booth/etc.) so it stays reusable rather than growing page-specific
 * assumptions. */

export type MapDraft = { lat: number; lng: number };

/** Vendor/event/booth-style markers need to read as visually distinct from
 * a plain pin (which uses Leaflet's default teardrop marker image) and need
 * to carry two independent pieces of state at a glance: the base color says
 * what layer/type it belongs to and whether it has an unsaved drag pending
 * (amber overrides everything else), and an optional red halo says its
 * stored coordinates have never actually been checked against the map. */
export function entityDivIcon(
  L: NonNullable<Window["L"]>,
  opts: { id: string; emoji: string; color: string; needsReview: boolean },
) {
  const ring = opts.needsReview
    ? `box-shadow:0 0 0 3px #dc2626,0 1px 4px rgba(0,0,0,.45);`
    : "box-shadow:0 1px 4px rgba(0,0,0,.45);";
  const html =
    `<div data-entity-id="${opts.id}" style="width:26px;height:26px;border-radius:50%;background:${opts.color};` +
    `border:3px solid #fff;${ring}display:flex;align-items:center;justify-content:center;font-size:13px;">` +
    `${opts.emoji}</div>`;
  return L.divIcon({ html, className: "", iconSize: [26, 26], iconAnchor: [13, 13] });
}

/** The one place marker sync happens, shared by every editable layer (Map
 * Studio's Pins/Vendors/Events, and the Event Zone editor's Booths/
 * Features) instead of copy-pasting the same add/update/remove loop per
 * layer. A draft position (staged but not yet saved) always wins over the
 * entity's own stored lat/lng so a marker never snaps back mid-edit.
 * `onDragEnd`/`onClick` only ever receive the entity's id (never the whole
 * object) - handlers are bound once, at marker-creation time, so anything
 * beyond a stable id would be a stale closure the moment that entity's
 * other fields changed. */
export function syncEditableLayer<T extends { id: string; lat: number; lng: number }>(config: {
  L: NonNullable<Window["L"]>;
  map: import("leaflet").Map;
  markersRef: React.MutableRefObject<Map<string, import("leaflet").Marker>>;
  entities: T[];
  drafts: Record<string, MapDraft>;
  show: boolean;
  draggable?: boolean;
  icon?: (entity: T, isDirty: boolean) => import("leaflet").DivIcon;
  opacity?: (entity: T) => number;
  tooltip: (entity: T, isDirty: boolean) => string;
  onDragEnd?: (id: string, lat: number, lng: number) => void;
  onClick: (id: string) => void;
}) {
  const { L, map, markersRef, entities, drafts, show, draggable, icon, opacity, tooltip, onDragEnd, onClick } = config;
  if (!show) {
    for (const [, marker] of markersRef.current) marker.remove();
    markersRef.current.clear();
    return;
  }

  const seen = new Set<string>();
  for (const entity of entities) {
    seen.add(entity.id);
    const draft = drafts[entity.id];
    const lat = draft ? draft.lat : entity.lat;
    const lng = draft ? draft.lng : entity.lng;
    let marker = markersRef.current.get(entity.id);
    if (!marker) {
      const opts: import("leaflet").MarkerOptions = { draggable: draggable ?? true };
      if (icon) opts.icon = icon(entity, false);
      marker = L.marker([lat, lng], opts).addTo(map);
      const id = entity.id;
      if (onDragEnd) {
        marker.on("dragend", () => {
          const pos = marker!.getLatLng();
          onDragEnd(id, pos.lat, pos.lng);
        });
      }
      marker.on("click", () => onClick(id));
      markersRef.current.set(entity.id, marker);
    } else {
      marker.setLatLng([lat, lng]);
    }
    if (icon) marker.setIcon(icon(entity, !!draft));
    if (opacity) marker.setOpacity(opacity(entity));
    marker.bindTooltip(tooltip(entity, !!draft), { permanent: false });
  }
  for (const [id, marker] of markersRef.current) {
    if (!seen.has(id)) {
      marker.remove();
      markersRef.current.delete(id);
    }
  }
}

/** Circular zone layer (e.g. a Danger Zone) - a small draggable handle
 * marker paired with a non-interactive circle that tracks it, since
 * Leaflet circles aren't natively draggable. Kept separate from
 * syncEditableLayer rather than forced through it: a zone circle also
 * carries a radius and needs its own L.Circle instance alongside the
 * handle marker, not just a single marker. Same staged-draft-then-save
 * contract as everywhere else in Map Studio - dragging never auto-saves. */
export function syncCircleZoneLayer<T extends { id: string; lat: number; lng: number; radius_meters: number }>(config: {
  L: NonNullable<Window["L"]>;
  map: import("leaflet").Map;
  markersRef: React.MutableRefObject<Map<string, import("leaflet").Marker>>;
  circlesRef: React.MutableRefObject<Map<string, import("leaflet").Circle>>;
  entities: T[];
  drafts: Record<string, MapDraft>;
  show: boolean;
  style: (entity: T, isDirty: boolean) => import("leaflet").PathOptions;
  tooltip: (entity: T, isDirty: boolean) => string;
  onDragEnd: (id: string, lat: number, lng: number) => void;
  onClick: (id: string) => void;
}) {
  const { L, map, markersRef, circlesRef, entities, drafts, show, style, tooltip, onDragEnd, onClick } = config;
  if (!show) {
    for (const [, marker] of markersRef.current) marker.remove();
    markersRef.current.clear();
    for (const [, circle] of circlesRef.current) circle.remove();
    circlesRef.current.clear();
    return;
  }

  const seen = new Set<string>();
  for (const entity of entities) {
    seen.add(entity.id);
    const draft = drafts[entity.id];
    const lat = draft ? draft.lat : entity.lat;
    const lng = draft ? draft.lng : entity.lng;

    let circle = circlesRef.current.get(entity.id);
    if (!circle) {
      circle = L.circle([lat, lng], { radius: entity.radius_meters, ...style(entity, false) }).addTo(map);
      circle.on("click", () => onClick(entity.id));
      circlesRef.current.set(entity.id, circle);
    } else {
      circle.setLatLng([lat, lng]);
      circle.setRadius(entity.radius_meters);
      circle.setStyle(style(entity, !!draft));
    }

    let marker = markersRef.current.get(entity.id);
    if (!marker) {
      const html =
        '<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #dc2626;' +
        'box-shadow:0 1px 4px rgba(0,0,0,.45);"></div>';
      marker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({ html, className: "", iconSize: [16, 16], iconAnchor: [8, 8] }),
      }).addTo(map);
      const id = entity.id;
      marker.on("dragend", () => {
        const pos = marker!.getLatLng();
        onDragEnd(id, pos.lat, pos.lng);
      });
      marker.on("click", () => onClick(id));
      markersRef.current.set(entity.id, marker);
    } else {
      marker.setLatLng([lat, lng]);
    }
    marker.bindTooltip(tooltip(entity, !!draft), { permanent: false });
  }
  for (const [id, marker] of markersRef.current) {
    if (!seen.has(id)) {
      marker.remove();
      markersRef.current.delete(id);
    }
  }
  for (const [id, circle] of circlesRef.current) {
    if (!seen.has(id)) {
      circle.remove();
      circlesRef.current.delete(id);
    }
  }
}
