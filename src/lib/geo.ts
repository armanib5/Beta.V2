const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in miles. */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

export interface AnchorCoords {
  lat: number;
  lng: number;
}

/**
 * Standardized proximity calculator used by the Map, Board, and Vendor
 * Directory alike — every item gets a `distance` (miles, or null if either
 * the item or the anchor has no coordinates), sorted closest-first with
 * items lacking coordinates pushed to the end rather than dropped.
 */
export function calculateProximity<T extends { lat: number | null; lng: number | null }>(
  items: T[],
  anchor: AnchorCoords | null,
): (T & { distance: number | null })[] {
  const withDistance = items.map((item) => ({
    ...item,
    distance:
      anchor && item.lat !== null && item.lng !== null
        ? haversineDistanceMiles(anchor.lat, anchor.lng, item.lat, item.lng)
        : null,
  }));

  if (!anchor) return withDistance;

  return withDistance.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
}

/** City/section centers — the fallback position for an item with no
 * lat/lng of its own, and the anchor set when a city or section pill is
 * picked instead of using GPS. Mirrored in public/shared/geo-anchor.js for
 * the V1 board/map (plain static pages, not part of this Next.js build). */
export interface CityCenter {
  id: string;
  city: string;
  section: string | null;
  label: string;
  lat: number;
  lng: number;
}

export const CITY_CENTERS: CityCenter[] = [
  { id: "sj-downtown", city: "San Jose", section: "Downtown", label: "Downtown San Jose", lat: 37.3382, lng: -121.8863 },
  { id: "sj-sanpedro", city: "San Jose", section: "San Pedro Square", label: "San Pedro Square", lat: 37.3369, lng: -121.8949 },
  { id: "sj-sofa", city: "San Jose", section: "SoFA District", label: "SoFA District", lat: 37.3302, lng: -121.8864 },
  { id: "sj-japantown", city: "San Jose", section: "Japantown", label: "Japantown", lat: 37.3497, lng: -121.8917 },
  { id: "sj-santana", city: "San Jose", section: "Santana Row", label: "Santana Row & Valley Fair", lat: 37.3199, lng: -121.9492 },
  { id: "sj-willow", city: "San Jose", section: "Willow Glen", label: "Willow Glen", lat: 37.3066, lng: -121.8897 },
  { id: "sj-alum", city: "San Jose", section: "Alum Rock", label: "Alum Rock", lat: 37.3563, lng: -121.8248 },
  { id: "sj-east", city: "San Jose", section: "East San Jose", label: "East San Jose", lat: 37.3444, lng: -121.8394 },
  { id: "sc-downtown", city: "Santa Clara", section: "Downtown", label: "Downtown Santa Clara", lat: 37.3541, lng: -121.9552 },
  { id: "sc-rivermark", city: "Santa Clara", section: "Rivermark", label: "Rivermark", lat: 37.3853, lng: -121.9645 },
  { id: "sv-downtown", city: "Sunnyvale", section: "Downtown", label: "Downtown Sunnyvale", lat: 37.3688, lng: -122.0363 },
  { id: "sv-moffett", city: "Sunnyvale", section: "Moffett Park", label: "Moffett Park", lat: 37.4085, lng: -122.0525 },
  { id: "mv-downtown", city: "Mountain View", section: "Downtown", label: "Downtown Mountain View", lat: 37.3894, lng: -122.0832 },
  { id: "mv-shoreline", city: "Mountain View", section: "Shoreline", label: "Shoreline", lat: 37.4048, lng: -122.0784 },
  { id: "camp-downtown", city: "Campbell", section: "Downtown", label: "Downtown Campbell", lat: 37.2872, lng: -121.95 },
  { id: "camp-pruneyard", city: "Campbell", section: "Pruneyard", label: "Pruneyard", lat: 37.2932, lng: -121.9447 },
];

export const CITIES = Array.from(new Set(CITY_CENTERS.map((c) => c.city)));

/** Nearest defined city/section center to a lat/lng — used as the fallback
 * "hood" for an item with real coordinates but no section_zone set. */
export function nearestCityCenter(lat: number, lng: number): CityCenter {
  let best = CITY_CENTERS[0];
  let bestDist = Infinity;
  for (const center of CITY_CENTERS) {
    const d = haversineDistanceMiles(lat, lng, center.lat, center.lng);
    if (d < bestDist) {
      bestDist = d;
      best = center;
    }
  }
  return best;
}

export function cityCenterFor(city: string, section?: string | null): CityCenter {
  const bySection = section && CITY_CENTERS.find((c) => c.city === city && c.section === section);
  if (bySection) return bySection;
  return CITY_CENTERS.find((c) => c.city === city) ?? CITY_CENTERS[0];
}

export type AnchorSource = "gps" | "city" | "section";

export interface Anchor extends AnchorCoords {
  label: string;
  source: AnchorSource;
}

const ANCHOR_STORAGE_KEY = "citypinned_anchor";

/** The current "near me" reference point — set from GPS, a picked city, or
 * a picked section pill. Stored in localStorage (not component state) so
 * it's shared across the Map, Board, and Vendor Directory even though two
 * of those are static pages outside this Next.js app, not just across
 * components within it — same origin means they already share storage. */
export function getAnchor(): Anchor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANCHOR_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Anchor) : null;
  } catch {
    return null;
  }
}

export function setAnchor(anchor: Anchor): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify(anchor));
    window.dispatchEvent(new CustomEvent("citypinned:anchor-changed", { detail: anchor }));
  } catch {
    // localStorage unavailable (private browsing, quota) — anchor just won't persist.
  }
}

export function clearAnchor(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANCHOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
