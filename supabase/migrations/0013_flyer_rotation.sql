-- CityPinned v2.0 — flyer rotation system for the Board's 3 sections:
--   Board 1 (Master/Seasonal) — the full category boards, unchanged
--     automatic behavior, but now hides any flyer whose status isn't
--     'active'.
--   Board 2 (Weekly/"This Week") — one curated flyer pinned per weekday.
--   Board 3 (Today/"Today Scratchpad") — one curated flyer for a specific
--     date, falling back to an automatic pick that deliberately excludes
--     whatever Board 2 is already showing for today unless an admin
--     explicitly overrides it.

-- `status` gates public visibility across all 3 boards without deleting
-- the row (Draft = not ready, Archived = retired). `details` is a lean
-- free-text field for flyer copy that doesn't fit the existing structured
-- columns (contact info, cost, policies) — keeps the LOV row itself the
-- single source of truth instead of a second table duplicating it.
alter table public.lov_entries
  add column if not exists details text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'draft', 'archived'));

create index if not exists lov_entries_status_idx on public.lov_entries (status);

-- FLYER_ROTATION — maps an lov_entries flyer onto a board slot. `flyer_id`
-- always points at an existing LOV row (no duplicated flyer data);
-- `assigned_day` is a weekday code ('mon'..'sun') for the weekly board, or
-- an ISO date ('YYYY-MM-DD') for a one-off today-board override, and is
-- null for the master board (no day scoping there). `category` is a small
-- free-text label an admin can set without a join, purely for display.
create table if not exists public.flyer_rotation (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid not null references public.lov_entries (id) on delete cascade,
  assigned_board text not null check (assigned_board in ('master', 'weekly', 'today')),
  assigned_day text,
  category text,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assigned_board, assigned_day, flyer_id)
);

create index if not exists flyer_rotation_board_day_idx on public.flyer_rotation (assigned_board, assigned_day);

drop trigger if exists set_updated_at on public.flyer_rotation;
create trigger set_updated_at before update on public.flyer_rotation
  for each row execute function public.set_updated_at();

alter table public.flyer_rotation enable row level security;

create policy "flyer rotation is publicly readable"
  on public.flyer_rotation for select
  using (true);

create policy "admin can insert flyer rotation"
  on public.flyer_rotation for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update flyer rotation"
  on public.flyer_rotation for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete flyer rotation"
  on public.flyer_rotation for delete
  using (exists (select 1 from public.admins where id = auth.uid()));
