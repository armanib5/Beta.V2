-- P1-2 (post-stabilization integration pass): DB-backed source of truth for
-- city/district geography, replacing the two hand-duplicated copies of the
-- same 18 rows that currently only exist as static JS (`src/lib/geo.ts`'s
-- CITY_CENTERS, mirrored "by hand" per its own comment in
-- public/shared/geo-anchor.js). Neither copy is queryable from SQL, so
-- there was no way to drive an admin City/District dropdown from real data.
--
-- This does NOT replace CITY_CENTERS - the client-side arrays stay (they're
-- read on every page load, a DB round-trip for 18 static rows would be
-- pure overhead) - it gives admin UI (P0-3's section_zone dropdown, P2-2's
-- Map Studio city filter) a real table to query instead of importing a
-- client-only TS module, and a single place to add a city/section later
-- without touching two files by hand.
--
-- `id` matches CITY_CENTERS' own `id` field exactly (e.g. "sj-downtown"),
-- which is already unique per city+section - unlike the bare `section`
-- label ("Downtown"), which collides across all 6 cities. lov_entries.
-- section_zone will be changed (see the app-code change accompanying this
-- migration) to store this `id`, not the ambiguous label, fixing the bug
-- where every `.find(c => c.section === zone)` lookup silently resolved to
-- San Jose regardless of which city was actually meant.
create table if not exists public.city_sections (
  id text primary key,
  city text not null,
  section text,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  sort_order int not null default 0
);

create index if not exists city_sections_city_idx on public.city_sections (city);

alter table public.city_sections enable row level security;

create policy "city sections are publicly readable"
  on public.city_sections for select
  using (true);

-- Seeded 1:1 from src/lib/geo.ts's CITY_CENTERS (and its
-- public/shared/geo-anchor.js mirror) at the time of writing. sort_order
-- matches each array's existing order so any future UI can just `order by
-- sort_order` instead of re-deriving it.
insert into public.city_sections (id, city, section, label, lat, lng, sort_order) values
  ('sj-downtown',    'San Jose',      'Downtown',          'Downtown San Jose',        37.3382, -121.8863, 0),
  ('sj-sanpedro',    'San Jose',      'San Pedro Square',  'San Pedro Square',         37.3369, -121.8949, 1),
  ('sj-sofa',        'San Jose',      'SoFA District',     'SoFA District',            37.3302, -121.8864, 2),
  ('sj-japantown',   'San Jose',      'Japantown',         'Japantown',                37.3497, -121.8917, 3),
  ('sj-santana',     'San Jose',      'Santana Row',       'Santana Row & Valley Fair',37.3199, -121.9492, 4),
  ('sj-willow',      'San Jose',      'Willow Glen',       'Willow Glen',              37.3066, -121.8897, 5),
  ('sj-alum',        'San Jose',      'Alum Rock',         'Alum Rock',                37.3563, -121.8248, 6),
  ('sj-east',        'San Jose',      'East San Jose',     'East San Jose',            37.3444, -121.8394, 7),
  ('sc-downtown',    'Santa Clara',   'Downtown',          'Downtown Santa Clara',     37.3541, -121.9552, 8),
  ('sc-rivermark',   'Santa Clara',   'Rivermark',         'Rivermark',                37.3853, -121.9645, 9),
  ('sv-downtown',    'Sunnyvale',     'Downtown',          'Downtown Sunnyvale',       37.3688, -122.0363, 10),
  ('sv-moffett',     'Sunnyvale',     'Moffett Park',      'Moffett Park',             37.4085, -122.0525, 11),
  ('mv-downtown',    'Mountain View', 'Downtown',          'Downtown Mountain View',   37.3894, -122.0832, 12),
  ('mv-shoreline',   'Mountain View', 'Shoreline',         'Shoreline',                37.4048, -122.0784, 13),
  ('camp-downtown',  'Campbell',      'Downtown',          'Downtown Campbell',        37.2872, -121.9500, 14),
  ('camp-pruneyard', 'Campbell',      'Pruneyard',         'Pruneyard',                37.2932, -121.9447, 15),
  ('gil-downtown',   'Gilroy',        'Downtown',          'Downtown Gilroy',          37.0058, -121.5683, 16),
  ('gil-outlets',    'Gilroy',        'Outlets',           'Gilroy Premium Outlets',   37.0136, -121.5758, 17)
on conflict (id) do nothing;
