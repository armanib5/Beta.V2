-- REPORT & TAKEDOWN — extends the `reports` table rather than creating a
-- second, parallel "reports_log" table: it already has id/target_type/
-- target_id/target_name/reason/details/status/created_at, a public
-- INSERT policy (anonymous reporting), and admin-only SELECT/UPDATE -
-- exactly the shape asked for, just missing a reporter IP column and any
-- actual auto-suspend behavior.
--
-- IMPORTANT: migration 0026 (which defines this table) was written into
-- this repo long ago but - confirmed directly with a live REST call,
-- same as 0025/0041/0043 before it - was never actually pasted into
-- Supabase. The table doesn't exist yet at all, so this migration
-- includes the full 0026 definition verbatim (idempotent either way)
-- instead of assuming it's already there.
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

drop policy if exists "anyone can submit a report" on public.reports;
create policy "anyone can submit a report"
  on public.reports for insert
  with check (true);

drop policy if exists "admin can read reports" on public.reports;
create policy "admin can read reports"
  on public.reports for select
  using (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can update reports" on public.reports;
create policy "admin can update reports"
  on public.reports for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

alter table public.reports
  add column if not exists reporter_ip text;

-- Lets a report - submitted by an anonymous public session with no admin
-- rights at all - immediately flip the reported vendor/event to hidden,
-- without a human in the loop. Deliberately no threshold: one report is
-- enough, matching "Report flags trigger immediate review and temporary
-- listing suspension pending investigation" - the tradeoff is a single
-- bad-faith report can take down a real listing; that's caught on
-- /admin/reports for manual review and reactivation, not prevented here.
create or replace function public.auto_suspend_on_report()
returns trigger as $$
begin
  begin
    if new.target_type = 'vendor' and new.target_id is not null then
      perform set_config('citypinned.bypass_privileged_guard', 'true', true);
      update public.vendors set status = 'suspended' where id = new.target_id::uuid and status <> 'suspended';
      perform set_config('citypinned.bypass_privileged_guard', 'false', true);
    elsif new.target_type = 'event' and new.target_id is not null then
      update public.lov_entries set status = 'archived' where id = new.target_id::uuid and status <> 'archived';
    end if;
  exception when others then
    -- A malformed/non-UUID target_id (e.g. a legacy static map pin with
    -- no real database row) should never block the report itself from
    -- being logged - just skip the suspend side effect.
    null;
  end;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists auto_suspend_on_report on public.reports;
create trigger auto_suspend_on_report
  after insert on public.reports
  for each row execute function public.auto_suspend_on_report();

-- protect_vendor_privileged_fields (0038) reverts `status` for any caller
-- that isn't service_role or a logged-in admin - which is exactly what an
-- anonymous report submitter is, so without this it would silently undo
-- the auto-suspend above. Adds ONE more narrow bypass (a same-transaction
-- flag only auto_suspend_on_report ever sets) - every existing check
-- (service_role, admin) is unchanged.
create or replace function public.protect_vendor_privileged_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.admins where id = auth.uid()) then
    return new;
  end if;

  if coalesce(current_setting('citypinned.bypass_privileged_guard', true), 'false') = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_founding_vendor := false;
    new.is_top10 := false;
    new.tier_id := null;
    new.category_tier := 'standard';
    new.is_featured := false;
  elsif tg_op = 'UPDATE' then
    new.status := old.status;
    new.is_founding_vendor := old.is_founding_vendor;
    new.is_top10 := old.is_top10;
    new.tier_id := old.tier_id;
    new.category_tier := old.category_tier;
    new.is_featured := old.is_featured;
  end if;

  return new;
end;
$$ language plpgsql security definer;
