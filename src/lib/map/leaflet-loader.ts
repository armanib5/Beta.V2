import { BASE_PATH } from "@/lib/site";

declare global {
  interface Window {
    L?: typeof import("leaflet");
  }
}

/** Loads the vendored Leaflet build (public/map/vendor/leaflet/*) instead of
 * adding a second copy of the same library as an npm dependency. Shared by
 * every React admin surface that embeds a Leaflet map (Map Studio, the
 * Event Zone editor) so they all load the exact same script/CSS the same
 * way. */
export function loadLeaflet(): Promise<NonNullable<Window["L"]>> {
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

/** The single tile provider shared by the Public Map, Admin Map Studio, and
 * the Event Zone editor - Geoapify's hosted `osm-carto` tiles. This is the
 * same open-source openstreetmap-carto stylesheet the app originally used
 * (rich business/hotel/restaurant/landmark labels, not just streets and
 * parks), served from production-safe infrastructure instead of hotlinking
 * tile.openstreetmap.org directly. CARTO Voyager (the interim choice) was
 * confirmed via direct tile comparison to omit this label tier entirely,
 * at any zoom - not a threshold that panning/zooming would cross. */
export const TILE_LAYER_URL = `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY}`;
export const TILE_LAYER_ATTRIBUTION =
  '&copy; OpenStreetMap contributors, <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Powered by Geoapify</a>';
export const TILE_LAYER_MAX_ZOOM = 20;
