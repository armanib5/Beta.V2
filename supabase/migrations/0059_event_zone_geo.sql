-- Event Zone editor rebuild: real Leaflet map instead of a blank 0-100
-- percentage grid, so the owner can trace an event's actual footprint
-- (streets, buildings, parks) instead of drawing on an abstract canvas.
-- Fully additive - every new column is nullable, no existing row's
-- meaning changes, and the one real event with existing percentage-grid
-- booths (Downtown San Jose Farmers Market) keeps rendering through the
-- exact unchanged legacy code path. A row is either "legacy percentage
-- mode" (x/y or points populated) or "geo mode" (lat/lng or points_geo
-- populated) - never both, never auto-converted between the two.

alter table public.booths
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.zone_boundaries
  add column if not exists points_geo jsonb;

alter table public.zone_boundaries drop constraint if exists zone_boundaries_boundary_type_check;
alter table public.zone_boundaries add constraint zone_boundaries_boundary_type_check
  check (boundary_type in ('fence', 'gate', 'exit', 'vendor_area', 'event_boundary', 'path'));
-- 'event_boundary' = the traced festival footprint itself (one per event,
-- enforced in the app, not here, so it doesn't fight copyZoneLayout()'s
-- bulk insert); 'path' = a walking path traced through the zone.

-- ---------------------------------------------------------------------------
-- ZONE_FEATURES - point-placed event infrastructure (stage, seating, food,
-- bar, gate marker, entrance, exit marker, info booth, restroom) that an
-- admin drops inside a traced event boundary. Deliberately a separate
-- table from `booths`, not a new `booths.feature_type` column: `booths`
-- carries a vendor-claim RLS policy ("status='open' or vendor_id=auth.uid()")
-- that would let any signed-in vendor claim a "Restroom" or "Stage" row via
-- a direct table call if these lived there instead. None of these types are
-- ever vendor-claimable, so this table gets the same public-read/admin-only
-- write shape as zone_boundaries, with no vendor policy at all.
-- ---------------------------------------------------------------------------
create table if not exists public.zone_features (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lov_entries (id) on delete cascade,
  feature_type text not null check (feature_type in
    ('stage', 'seating', 'food', 'bar', 'gate', 'entrance', 'exit', 'info', 'restroom')),
  label text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zone_features_event_idx on public.zone_features (event_id);

drop trigger if exists set_updated_at on public.zone_features;
create trigger set_updated_at before update on public.zone_features
  for each row execute function public.set_updated_at();

alter table public.zone_features enable row level security;

drop policy if exists "zone features are publicly readable" on public.zone_features;
create policy "zone features are publicly readable"
  on public.zone_features for select
  using (true);

drop policy if exists "admin can insert zone features" on public.zone_features;
create policy "admin can insert zone features"
  on public.zone_features for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can update zone features" on public.zone_features;
create policy "admin can update zone features"
  on public.zone_features for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can delete zone features" on public.zone_features;
create policy "admin can delete zone features"
  on public.zone_features for delete
  using (exists (select 1 from public.admins where id = auth.uid()));
