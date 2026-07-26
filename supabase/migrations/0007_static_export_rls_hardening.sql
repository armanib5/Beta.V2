-- CityPinned v2.0 — static-export architecture: the deployed frontend has
-- no backend/service-role key at all, so Postgres Row Level Security
-- becomes the ONLY enforcement layer for every write. This migration:
--   1. Adds an `admins` table so admin-only actions (booth board, vendor
--      approval) can be authorized in the database itself.
--   2. Adds a vendor self-signup INSERT policy (the old service-role
--      /api/vendor/claim route is gone).
--   3. Adds a trigger that stops a vendor from granting themselves
--      "active"/"Founding Vendor"/"Top 10"/a tier via their own INSERT or
--      UPDATE — those fields can now only change through an admin session,
--      since there is no more server-side gate to protect them.
--   4. Adds admin write policies for `vendors` (approve signups) and
--      `booths` (the venue board), which previously only worked via the
--      removed service-role API routes.

-- ---------------------------------------------------------------------------
-- ADMINS — membership table. No INSERT policy is defined here on purpose:
-- add the first admin yourself from the Supabase SQL editor, e.g.
--   insert into public.admins (id) select id from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "a user can check their own admin membership"
  on public.admins for select
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- VENDORS — self-signup insert, admin read/write of any row, and a
-- trigger that protects the privileged fields from self-elevation.
-- ---------------------------------------------------------------------------
create policy "vendor can insert own profile"
  on public.vendors for insert
  with check (auth.uid() = id);

create policy "admin can select any vendor"
  on public.vendors for select
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update any vendor"
  on public.vendors for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create or replace function public.protect_vendor_privileged_fields()
returns trigger as $$
begin
  if exists (select 1 from public.admins where id = auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_founding_vendor := false;
    new.is_top10 := false;
    new.tier_id := null;
  elsif tg_op = 'UPDATE' then
    new.status := old.status;
    new.is_founding_vendor := old.is_founding_vendor;
    new.is_top10 := old.is_top10;
    new.tier_id := old.tier_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_vendor_privileged_fields on public.vendors;
create trigger protect_vendor_privileged_fields
  before insert or update on public.vendors
  for each row execute function public.protect_vendor_privileged_fields();

-- ---------------------------------------------------------------------------
-- BOOTHS — admin-only writes (the venue board). Public read policy already
-- exists from migration 0004.
-- ---------------------------------------------------------------------------
create policy "admin can insert booths"
  on public.booths for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update booths"
  on public.booths for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete booths"
  on public.booths for delete
  using (exists (select 1 from public.admins where id = auth.uid()));
