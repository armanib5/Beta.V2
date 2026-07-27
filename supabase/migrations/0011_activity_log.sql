-- CityPinned v2.0 — Legacy Dashboard: a real, timestamped history of
-- admin actions (approvals, boosts, booth/event creation), not just the
-- current snapshot a plain SELECT gives you. Written by the admin UI
-- itself at the moment of each action (app-level logging), not a DB
-- trigger — this repo has no service-role backend to run one from, and
-- every write already goes through an authenticated admin session, so
-- logging at that same point is both simpler and just as trustworthy.
--
-- Only covers actions taken from now on — there's no way to
-- retroactively reconstruct history for changes made before this table
-- existed, only their current state (already visible in Bookkeeping).

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor', 'event', 'booth')),
  entity_id uuid not null,
  entity_name text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

create policy "admin can read activity log"
  on public.activity_log for select
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can write activity log"
  on public.activity_log for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));
