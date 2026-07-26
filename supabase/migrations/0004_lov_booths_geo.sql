-- CityPinned v2.0 — LOV (List of Vendors & Events) bulk listings, booth
-- board (admin Map/Board toggle), and geolocation columns for Haversine
-- "Near You" sorting.

-- ---------------------------------------------------------------------------
-- Location columns for Haversine proximity sorting on vendor cards.
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- ---------------------------------------------------------------------------
-- LOV_ENTRIES — bulk-seeded "List of Vendors & Events" for a given month.
-- Distinct from the paid, self-service `vendors` table: these are admin-
-- curated listings (from a pasted spreadsheet/list) that can optionally be
-- linked to a full vendor account once that vendor claims a permanent
-- profile. `type = 'event'` rows power the month-to-month calendar/flyer
-- view; `type = 'vendor'` rows show up as guest listings in the directory.
-- ---------------------------------------------------------------------------
create table if not exists public.lov_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('event', 'vendor')),
  name text not null,
  event_date date,
  location text,
  lat double precision,
  lng double precision,
  instagram_handle text,
  category_id uuid references public.categories (id),
  booth_tier text not null default 'regular' check (booth_tier in ('top', 'regular')),
  flyer_image_url text,
  vendor_id uuid references public.vendors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, name, event_date)
);

create index if not exists lov_entries_type_idx on public.lov_entries (type);
create index if not exists lov_entries_date_idx on public.lov_entries (event_date);

drop trigger if exists set_updated_at on public.lov_entries;
create trigger set_updated_at before update on public.lov_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- BOOTHS — the admin Map/Board: booths belong to an event (a `lov_entries`
-- row with type='event') and can be tapped by an admin to mark
-- open/reserved/claimed, with a visual tier distinction (gold "Top Booth"
-- vs. standard). Full interactive SVG blueprint placement is future work —
-- (x, y) are percentage coordinates (0-100) on a simple grid/board for now.
-- ---------------------------------------------------------------------------
create table if not exists public.booths (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lov_entries (id) on delete cascade,
  label text not null,
  tier text not null default 'regular' check (tier in ('top', 'regular')),
  status text not null default 'open' check (status in ('open', 'reserved', 'claimed')),
  vendor_id uuid references public.vendors (id) on delete set null,
  x numeric,
  y numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, label)
);

create index if not exists booths_event_idx on public.booths (event_id);

drop trigger if exists set_updated_at on public.booths;
create trigger set_updated_at before update on public.booths
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: both tables are publicly readable (the calendar/directory/board are
-- public pages); all writes go through server routes using the service-role
-- key and an app-level admin-email check, so no public write policies.
-- ---------------------------------------------------------------------------
alter table public.lov_entries enable row level security;
alter table public.booths enable row level security;

create policy "lov entries are publicly readable"
  on public.lov_entries for select
  using (true);

create policy "booths are publicly readable"
  on public.booths for select
  using (true);
