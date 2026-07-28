-- CityPinned v2.0 — real self-service flyer/event submission, and a
-- self-service Boost/Feature request a vendor can start on their own.
--
-- The Board's "Post a Flyer" button has existed since V1, but it only
-- ever wrote to the submitter's own browser (localStorage) — nothing
-- reached the real database, and the only INSERT policy on lov_entries
-- (migration 0008) is admin-only, so a real public submission would have
-- been rejected by RLS anyway even if the button had tried. This
-- migration makes it real: anyone can submit a flyer, but it always
-- lands as 'pending' until an admin approves it — never live on its own.

alter table public.lov_entries drop constraint if exists lov_entries_status_check;
alter table public.lov_entries add constraint lov_entries_status_check
  check (status in ('active', 'draft', 'pending', 'archived'));

drop policy if exists "anyone can submit a flyer for review" on public.lov_entries;
create policy "anyone can submit a flyer for review"
  on public.lov_entries for insert
  with check (true);

-- Forces a non-admin submission to 'pending' regardless of what status
-- value was sent, same pattern as protect_vendor_privileged_fields for
-- vendors — the submitter (logged in or anonymous) can never make their
-- own flyer go live without review.
create or replace function public.force_pending_lov_submission()
returns trigger as $$
begin
  if exists (select 1 from public.admins where id = auth.uid()) then
    return new;
  end if;
  new.status := 'pending';
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists force_pending_lov_submission on public.lov_entries;
create trigger force_pending_lov_submission
  before insert on public.lov_entries
  for each row execute function public.force_pending_lov_submission();

-- ---------------------------------------------------------------------------
-- Self-service Boost/Feature request: a vendor can flag "I paid, please
-- activate" on their own row (not protected by
-- protect_vendor_privileged_fields, same as every other non-privileged
-- column on `vendors` a vendor can already self-update) — an admin still
-- has to actually grant is_top10/category_tier/is_featured, this just
-- puts the vendor in the admin's queue without needing a support email.
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists boost_requested_at timestamptz;
