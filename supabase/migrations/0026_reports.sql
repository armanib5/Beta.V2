-- The Report form (public/board/js/reports.js) has been calling
-- .from("reports").insert(...) since it was built, but the `reports`
-- table it targets was never actually created in this project's
-- migrations — every submission (vendor/event reports AND the new
-- "Report a Bug" app-level report) has been silently failing. This adds
-- the real table plus an admin-only read/triage policy.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text,
  target_name text,
  reason text not null,
  details text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

create policy "anyone can submit a report"
  on public.reports for insert
  with check (true);

create policy "admin can read reports"
  on public.reports for select
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update reports"
  on public.reports for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));
