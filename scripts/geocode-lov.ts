/**
 * One-off enrichment: fills in lat/lng on every row in seed/lov.json.
 *
 * Strategy: geocode each row's `location` string via Nominatim (OpenStreetMap,
 * no API key required); if geocoding fails or finds nothing, fall back to a
 * central-San-Jose coordinate so the entry still displays on the map. Many
 * rows share an identical location string (e.g. all vendors at one market),
 * so lookups are cached and only issued once per unique string, at
 * Nominatim's required ~1 req/sec politeness rate.
 *
 * Usage: npx tsx scripts/geocode-lov.ts [path-to-lov.json]
 */
import { readFileSync, writeFileSync } from "node:fs";

const CENTRAL_SAN_JOSE = { lat: 37.3382, lng: -121.8863 };
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CityPinnedV2-LOVGeocoder/1.0 (contact: armanib56@gmail.com)";

interface LovRow {
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Vendor rows are written as "<Market Name> — <Address>", so the address
// comes *after* the dash there, while event rows are written as
// "<Address> — <description>" (address *before* the dash). A blind
// dash-split can't tell those apart, so known market-name prefixes are
// mapped to their address directly; anything else falls back to the
// "address before the dash" convention used by event rows.
const MARKET_ADDRESS_QUERIES: Record<string, string> = {
  "Downtown San Jose Farmers Market": "San Pedro Square, San Jose, CA",
  "Japantown Farmers Market": "357 E. Taylor St, San Jose, CA",
  "Santana Row Farmers Market": "Santana Row, San Jose, CA",
};

// Two locations whose generic parse still didn't resolve well: "Downtown
// Campbell, CA" collides with Campbell River, BC in Nominatim's index, and
// "History Park San Jose, 1650 S 10th St" wasn't indexed as written — both
// verified manually against a cleaner query before hardcoding here.
const QUERY_OVERRIDES: Record<string, string> = {
  "E. Campbell Ave & N. 1st St, Downtown Campbell, CA":
    "Campbell, Santa Clara County, California, USA",
  "History Park San Jose, 1650 S 10th St, San Jose, CA": "History Park, San Jose, CA",
};

function toGeocodeQuery(location: string): string {
  for (const [marketName, address] of Object.entries(MARKET_ADDRESS_QUERIES)) {
    if (location.startsWith(marketName)) return address;
  }

  const addressPart = location
    .split(" — ")[0]
    .replace(/\([^)]*\)/g, "") // strip parenthetical asides anywhere, not just at the end
    .replace(/\s*,\s*,/g, ",") // collapse the double comma a mid-string strip can leave behind
    .replace(/\s+/g, " ")
    .trim();

  return QUERY_OVERRIDES[addressPart] ?? addressPart;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

async function main() {
  const filePath = process.argv[2] ?? "seed/lov.json";
  const rows: LovRow[] = JSON.parse(readFileSync(filePath, "utf-8"));

  const uniqueLocations = [...new Set(rows.map((r) => r.location).filter((l): l is string => !!l))];
  console.log(`${rows.length} rows, ${uniqueLocations.length} unique location strings to geocode.`);

  const cache = new Map<string, { lat: number; lng: number; source: "geocoded" | "fallback" }>();

  for (const [i, location] of uniqueLocations.entries()) {
    const query = toGeocodeQuery(location);
    const result = await geocode(query);
    if (result) {
      cache.set(location, { ...result, source: "geocoded" });
      console.log(`✓ [${i + 1}/${uniqueLocations.length}] "${query}" -> ${result.lat}, ${result.lng}`);
    } else {
      cache.set(location, { ...CENTRAL_SAN_JOSE, source: "fallback" });
      console.log(`… [${i + 1}/${uniqueLocations.length}] "${query}" -> no match, using central San Jose fallback`);
    }
    await sleep(1100); // Nominatim usage policy: max ~1 request/second
  }

  let geocoded = 0;
  let fallback = 0;
  for (const row of rows) {
    const hit = row.location ? cache.get(row.location) : undefined;
    const coords = hit ?? { ...CENTRAL_SAN_JOSE, source: "fallback" as const };
    row.lat = coords.lat;
    row.lng = coords.lng;
    if (coords.source === "geocoded") geocoded++;
    else fallback++;
  }

  writeFileSync(filePath, JSON.stringify(rows, null, 2) + "\n");
  console.log(`\nWrote ${filePath}. ${geocoded} rows geocoded, ${fallback} rows on central-San-Jose fallback.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
