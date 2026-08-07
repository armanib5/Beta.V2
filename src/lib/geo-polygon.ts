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
