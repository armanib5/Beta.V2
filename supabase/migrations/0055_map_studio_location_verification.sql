-- Admin Map Studio: track whether a vendor's or event's stored coordinates
-- have ever actually been checked against the map. Most vendor lat/lng was
-- set from a phone's raw GPS at signup and never verified against a real
-- map; events fall back to a section-zone or city-center centroid when no
-- lat/lng was ever entered. Every existing row defaults to NULL (needs
-- review) rather than being marked verified, since that reflects reality -
-- nothing has actually been visually checked yet.

alter table public.vendors
  add column if not exists location_verified_at timestamptz;

alter table public.lov_entries
  add column if not exists location_verified_at timestamptz;
