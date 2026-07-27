/* Shared "near me" anchor + city/section centers for the Map and Board —
   the plain-JS twin of src/lib/geo.ts's calculateProximity/CITY_CENTERS/
   getAnchor/setAnchor. Kept in sync by hand since these are static pages
   outside the Next.js build, not modules it can import. Both sides read
   and write the SAME localStorage key ("citypinned_anchor") — the Map,
   Board, and Vendor Directory are served from the same origin, so picking
   a city here or on the Vendor Directory really does carry over. */

var CITY_CENTERS = [
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
  { id: "camp-pruneyard", city: "Campbell", section: "Pruneyard", label: "Pruneyard", lat: 37.2932, lng: -121.9447 }
];

var ANCHOR_STORAGE_KEY = "citypinned_anchor";

/* Self-contained on purpose (board/js/app.js has no haversine of its own —
   map.js does, and harmlessly redefines the same formula when both this
   file and map.js are loaded on the same page). */
function haversine(lat1, lng1, lat2, lng2) {
  var R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateProximity(items, anchor, getLat, getLng) {
  getLat = getLat || function (i) { return i.lat; };
  getLng = getLng || function (i) { return i.lng; };
  var withDistance = items.map(function (item) {
    var lat = getLat(item), lng = getLng(item);
    var distance = (anchor && lat != null && lng != null) ? haversine(anchor.lat, anchor.lng, lat, lng) : null;
    return { item: item, distance: distance };
  });
  if (!anchor) return withDistance;
  withDistance.sort(function (a, b) {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  return withDistance;
}

function nearestCityCenter(lat, lng) {
  var best = CITY_CENTERS[0], bestDist = Infinity;
  CITY_CENTERS.forEach(function (c) {
    var d = haversine(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  return best;
}

/* The Board's HOODS_SJ (and the Map's own HOODS for San Jose) use plain
   ids ("downtown", "japantown", ...) with no "sj-" prefix, while every
   other city's board id ("sc", "sv", "mv", "camp") already matches
   CITY_CENTERS' id prefixes. The Board doesn't load the Map's coordinate
   data at all, so this is how it resolves a city/hood pair to a real
   lat/lng for setting the shared anchor. Defaults to that city's
   "downtown" entry when no specific hood is given (every city besides San
   Jose has no hood picker on the Board today). */
function hoodCoords(cityId, hoodId) {
  var lookupId = cityId + "-" + (hoodId || "downtown");
  return CITY_CENTERS.find(function (c) { return c.id === lookupId; }) || null;
}

function getAnchor() {
  try {
    var raw = window.localStorage.getItem(ANCHOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAnchor(anchor) {
  try {
    window.localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify(anchor));
    window.dispatchEvent(new CustomEvent("citypinned:anchor-changed", { detail: anchor }));
  } catch (e) {
    // localStorage unavailable — anchor just won't persist.
  }
}
