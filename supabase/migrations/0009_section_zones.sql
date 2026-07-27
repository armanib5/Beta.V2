-- CityPinned v2.0 — section/zone filtering within a city (Downtown, San
-- Pedro Square, Santana Row, SoFA District, etc.), so the board and map
-- can filter to one zone instead of only whole-city granularity.
alter table public.lov_entries
  add column if not exists section_zone text;

create index if not exists lov_entries_section_zone_idx on public.lov_entries (section_zone);
