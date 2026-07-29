-- FIX 1: vendors_status_check on the live database was still the original
-- ('pending','active','suspended') from migration 0001 - migration 0025's
-- redefinition to add 'rejected' never actually took effect here, even
-- though every part of the app (types, the Reject button, this session's
-- own status-log trigger) has assumed 'rejected' was valid the whole
-- time. Confirmed directly: a real UPDATE to status='rejected' was
-- rejected by Postgres with exactly this constraint name. Re-running
-- 0025's definition (idempotent - drop-if-exists then re-add) is the fix;
-- nothing else in this migration touches existing data.
alter table public.vendors drop constraint if exists vendors_status_check;
alter table public.vendors add constraint vendors_status_check
  check (status in ('pending', 'active', 'suspended', 'rejected'));

-- FIX 2: vendor_boost_bookings only ever got a public SELECT policy
-- (migration 0040) - there was never an INSERT/UPDATE policy for admins,
-- so the Placements page's "Grant Now" (comp a boost, e.g. a cash
-- customer paid off-platform) and "End Now" buttons - which write
-- directly from the admin's own authenticated browser session, not
-- through the service-role webhook - were rejected by RLS every time.
create policy "admin can insert boost bookings"
  on public.vendor_boost_bookings for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update boost bookings"
  on public.vendor_boost_bookings for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete boost bookings"
  on public.vendor_boost_bookings for delete
  using (exists (select 1 from public.admins where id = auth.uid()));

-- FIX 3: the Board/Map's approval badge could only ever count pending
-- lov_entries (flyers/events), never pending vendors, because those
-- pages use a plain anon Supabase client with no real admin session -
-- unlike the Next.js app's header badge, which counts pending vendors +
-- pending flyers + boost requests via a real authenticated admin
-- session. That's why the two badges disagreed (e.g. right now, with
-- only a pending VENDOR and zero pending flyers, the main app correctly
-- shows 1 and the Board/Map correctly-per-their-own-logic showed 0) -
-- not a bug in either individually, but a confusing split. This function
-- returns only a bare count (never vendor details), so it's safe to let
-- any caller - even anon - execute it, and both surfaces can now show
-- the exact same number.
create or replace function public.admin_pending_count()
returns integer as $$
  select
    (select count(*) from public.vendors where status = 'pending')::int +
    (select count(*) from public.lov_entries where status = 'pending')::int +
    (select count(*) from public.vendors where boost_requested_at is not null and is_top10 = false)::int;
$$ language sql stable security definer;

grant execute on function public.admin_pending_count() to anon, authenticated;
