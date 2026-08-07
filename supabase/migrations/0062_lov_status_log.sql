-- Flyer approve/reject today is a bare status update with no logging at
-- all - lov_status_log gives it the same "who/when/from-what/to-what"
-- audit trail vendors.status already gets via vendor_status_log
-- (migrations 0025/0043). Reject also gets its own real status instead
-- of overloading 'archived' (which also means "an admin manually took
-- this down" - no way to tell those apart later).
alter table public.lov_entries drop constraint if exists lov_entries_status_check;
alter table public.lov_entries add constraint lov_entries_status_check
  check (status in ('active', 'draft', 'pending', 'archived', 'rejected'));

create table if not exists public.lov_status_log (
  id uuid primary key default gen_random_uuid(),
  lov_entry_id uuid not null references public.lov_entries (id) on delete cascade,
  old_status text,
  new_status text not null,
  reviewer_email text,
  reason text,
  changed_at timestamptz not null default now()
);

create index if not exists lov_status_log_entry_idx on public.lov_status_log (lov_entry_id);

alter table public.lov_status_log enable row level security;

drop policy if exists "admin can read lov status log" on public.lov_status_log;
create policy "admin can read lov status log"
  on public.lov_status_log for select
  using (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can write lov status log" on public.lov_status_log;
create policy "admin can write lov status log"
  on public.lov_status_log for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));
