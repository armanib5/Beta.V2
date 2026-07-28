-- CityPinned v2.0 — booth sizing for the Event Zone Map: an admin placing
-- real vendor booths (e.g. the Downtown San Jose Farmers Market) needs to
-- size each booth to match its real footprint, not just position it.
alter table public.booths
  add column if not exists width numeric,
  add column if not exists height numeric;
