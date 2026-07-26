-- CityPinned v2.0 — admin write access for lov_entries, and letting a
-- booth reference a guest flyer (lov_entries) in addition to a full paid
-- vendor account. Migration 0007 added admin write policies for `vendors`
-- and `booths` but missed `lov_entries` entirely, so events and vendor
-- flyers could only ever be created via the Supabase SQL editor — the
-- admin board's "seed the LOV first" message was a dead end with no
-- in-app way through it.

-- ---------------------------------------------------------------------------
-- LOV_ENTRIES — admin-only writes. Public read policy already exists from
-- migration 0004.
-- ---------------------------------------------------------------------------
create policy "admin can insert lov entries"
  on public.lov_entries for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update lov entries"
  on public.lov_entries for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete lov entries"
  on public.lov_entries for delete
  using (exists (select 1 from public.admins where id = auth.uid()));

-- ---------------------------------------------------------------------------
-- BOOTHS — a booth can now show a guest vendor's flyer (an lov_entries row
-- with type='vendor', for a vendor who hasn't made a full paid account)
-- instead of only a claimed `vendors` row. Exactly one of vendor_id /
-- lov_entry_id should be set at a time; enforced at the application layer
-- rather than a check constraint, so a vendor can still be assigned either
-- way without extra friction.
-- ---------------------------------------------------------------------------
alter table public.booths
  add column if not exists lov_entry_id uuid references public.lov_entries (id) on delete set null;
