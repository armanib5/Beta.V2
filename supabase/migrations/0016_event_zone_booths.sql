-- CityPinned v2.0 — interactive Event Zone Map: numbered/positioned booths
-- with a top/standard tier and open/occupied/reserved status (aligning the
-- existing `booths` table's vocabulary with the venue-map UI), plus a new
-- `zone_boundaries` table for the fences/gates/exits/vendor-area lines the
-- SVG venue map draws over the booth grid.

-- ---------------------------------------------------------------------------
-- BOOTHS — add a numeric booth_number for the venue map's grid labels, and
-- rename the tier/status vocabulary to match the venue-map spec:
--   tier:   'regular' -> 'standard'  (still 'top' for the gold tier)
--   status: 'claimed' -> 'occupied'  (still 'open' / 'reserved')
-- ---------------------------------------------------------------------------
alter table public.booths
  add column if not exists booth_number integer;

alter table public.booths drop constraint if exists booths_tier_check;
update public.booths set tier = 'standard' where tier = 'regular';
alter table public.booths add constraint booths_tier_check check (tier in ('top', 'standard'));
alter table public.booths alter column tier set default 'standard';

alter table public.booths drop constraint if exists booths_status_check;
update public.booths set status = 'occupied' where status = 'claimed';
alter table public.booths add constraint booths_status_check check (status in ('open', 'occupied', 'reserved'));

create index if not exists booths_number_idx on public.booths (event_id, booth_number);

-- A vendor can claim any open booth for themselves, or release one they
-- already hold back to open — but never touch a booth someone else holds,
-- and never assign a booth to anyone but themselves.
drop policy if exists "vendor can claim or release an available booth" on public.booths;
create policy "vendor can claim or release an available booth"
  on public.booths for update
  using (status = 'open' or vendor_id = auth.uid())
  with check (vendor_id = auth.uid() or vendor_id is null);

-- ---------------------------------------------------------------------------
-- ZONE_BOUNDARIES — fences, gates, exits, and vendor-area outlines drawn on
-- the SVG venue map for a given event. `points` is an ordered array of
-- {x, y} percentage coordinates (0-100) forming a line or closed polygon,
-- the same coordinate system booths.x/booths.y already use.
-- ---------------------------------------------------------------------------
create table if not exists public.zone_boundaries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lov_entries (id) on delete cascade,
  boundary_type text not null check (boundary_type in ('fence', 'gate', 'exit', 'vendor_area')),
  label text,
  points jsonb not null default '[]'::jsonb,
  vendor_id uuid references public.vendors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zone_boundaries_event_idx on public.zone_boundaries (event_id);

drop trigger if exists set_updated_at on public.zone_boundaries;
create trigger set_updated_at before update on public.zone_boundaries
  for each row execute function public.set_updated_at();

alter table public.zone_boundaries enable row level security;

drop policy if exists "zone boundaries are publicly readable" on public.zone_boundaries;
create policy "zone boundaries are publicly readable"
  on public.zone_boundaries for select
  using (true);

drop policy if exists "admin can insert zone boundaries" on public.zone_boundaries;
create policy "admin can insert zone boundaries"
  on public.zone_boundaries for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can update zone boundaries" on public.zone_boundaries;
create policy "admin can update zone boundaries"
  on public.zone_boundaries for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can delete zone boundaries" on public.zone_boundaries;
create policy "admin can delete zone boundaries"
  on public.zone_boundaries for delete
  using (exists (select 1 from public.admins where id = auth.uid()));
