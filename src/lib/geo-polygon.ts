export interface LatLngPoint {
  lat: number;
  lng: number;
}

/** Plain ray-casting point-in-polygon test (even-odd rule), used to keep
 * Event Zone feature placement (booths/stages/etc.) inside the traced
 * event boundary. No dependency needed for this - it's ~15 lines. A
 * self-intersecting polygon still gets a deterministic answer; it just may
 * not match the admin's mental model, which is fine since the live-filled
 * boundary render while tracing is the real feedback loop for that, not
 * this function. */
export function pointInPolygon(point: LatLngPoint, polygon: LatLngPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Shortest distance from a point to a line segment, in meters - flat
 * (equirectangular) approximation, accurate enough at the scale of one
 * event footprint (a city block or two). */
function distanceToSegmentMeters(point: LatLngPoint, a: LatLngPoint, b: LatLngPoint): number {
  const mLng = metersPerDegLng(point.lat);
  const px = point.lng * mLng;
  const py = point.lat * METERS_PER_DEG_LAT;
  const ax = a.lng * mLng;
  const ay = a.lat * METERS_PER_DEG_LAT;
  const bx = b.lng * mLng;
  const by = b.lat * METERS_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/** Same "is this click inside the event footprint" question pointInPolygon
 * answers, but forgiving of a click that lands just outside the traced
 * edge - real event boundaries are often traced as a thin strip following
 * a street rather than a wide shape (e.g. First Friday Art Walk's SoFA
 * District corridor), and a strict inside-only check made it very easy to
 * miss the shape entirely while trying to place a booth or stage right
 * next to it, with no visible marker or feedback to explain why nothing
 * happened. toleranceMeters is how far outside the traced edge a click may
 * still land and count - ~12m is roughly a sidewalk-plus-half-a-street,
 * generous enough to make placement practical without accepting clicks
 * that are clearly nowhere near the event. */
export function pointNearPolygon(point: LatLngPoint, polygon: LatLngPoint[], toleranceMeters: number): boolean {
  if (polygon.length < 3) return false;
  if (pointInPolygon(point, polygon)) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (distanceToSegmentMeters(point, polygon[j], polygon[i]) <= toleranceMeters) return true;
  }
  return false;
}
