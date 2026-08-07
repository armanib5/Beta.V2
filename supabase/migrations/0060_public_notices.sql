-- Public Notices: the foundation for a future V3 "verified city/government
-- notice" system, scoped down for now to exactly one lightweight use case -
-- an admin-drawn circular map zone the public should temporarily avoid
-- (Danger Zone / Restricted Area). `notice_type` is a widenable check
-- constraint rather than a fixed column or a separate lookup table, the
-- same pattern already used for `zone_boundaries.boundary_type` and
-- `zone_features.feature_type` - adding a future type (construction, road
-- closure, emergency, event area) is a one-line constraint change, not a
-- schema redesign. RLS mirrors zone_boundaries exactly: public read,
-- admin-only write.

create table if not exists public.public_notices (
  id uuid primary key default gen_random_uuid(),
  notice_type text not null default 'danger_zone' check (notice_type in ('danger_zone')),
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'resolved')),
  lat double precision not null,
  lng double precision not null,
  radius_meters double precision not null default 50,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_notices_status_idx on public.public_notices (status);

drop trigger if exists set_updated_at on public.public_notices;
create trigger set_updated_at before update on public.public_notices
  for each row execute function public.set_updated_at();

alter table public.public_notices enable row level security;

drop policy if exists "public notices are publicly readable" on public.public_notices;
create policy "public notices are publicly readable"
  on public.public_notices for select
  using (true);

drop policy if exists "admin can insert public notices" on public.public_notices;
create policy "admin can insert public notices"
  on public.public_notices for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can update public notices" on public.public_notices;
create policy "admin can update public notices"
  on public.public_notices for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can delete public notices" on public.public_notices;
create policy "admin can delete public notices"
  on public.public_notices for delete
  using (exists (select 1 from public.admins where id = auth.uid()));

-- Initial zone: real hazard closure at Circle of Palms Plaza, Downtown San
-- Jose (geocoded, not guessed - 37.3334355, -121.8896659; the plaza itself
-- is roughly 70-100m across, so a 45m radius covers it with a small margin).
insert into public.public_notices
  (notice_type, title, description, status, lat, lng, radius_meters, start_date)
select
  'danger_zone',
  'Circle of Palms Safety Closure',
  'Temporary restricted area due to hazardous palm tree removal. Please avoid entering the barricaded area. Events scheduled for this location may be relocated until work is complete.',
  'active',
  37.3334355,
  -121.8896659,
  45,
  current_date
where not exists (
  select 1 from public.public_notices where title = 'Circle of Palms Safety Closure'
);
