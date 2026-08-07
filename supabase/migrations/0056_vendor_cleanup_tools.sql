-- Admin Cleanup tools: an explicit "Test Account" tag admins can set, and
-- a public-visibility rule that hides both test accounts and vendors who
-- never finished onboarding (picked zero categories) - two placeholder
-- signups ("-citypin-", "Citypin-") were showing up as content-less cards
-- in the Shops board section, which is what this closes off. Narrowing
-- the existing public SELECT policy (rather than filtering in each of
-- Board/Map/Directory/Top10 separately) makes this enforced once, at the
-- database, for every surface at once - a vendor's own session and the
-- admin's session both have their own separate SELECT policies already
-- and are unaffected.

alter table public.vendors
  add column if not exists is_test_account boolean not null default false;

drop policy if exists "active vendor profiles are publicly readable" on public.vendors;
create policy "active vendor profiles are publicly readable"
  on public.vendors for select
  using (
    status = 'active'
    and is_test_account = false
    and exists (select 1 from public.vendor_categories vc where vc.vendor_id = vendors.id)
  );

-- ---------------------------------------------------------------------------
-- Duplicate-vendor merge: reassigns the known set of vendor-linked records
-- from `remove_id` to `keep_id` so an admin can consolidate a duplicate
-- signup into the real account instead of losing that history. Admin-only
-- (checked inside the function, not just relied on at the call site).
-- Deliberately does NOT delete `remove_id` itself - that stays a separate,
-- explicit Archive/Delete action through the existing two-step confirm UI,
-- so a merge is never a one-click permanent deletion.
-- ---------------------------------------------------------------------------
create or replace function public.merge_vendor_data(keep_id uuid, remove_id uuid)
returns jsonb as $$
declare
  n_categories int;
  n_photos int;
  n_menu_items int;
  n_listings int;
  n_hosted_listings int;
  n_booths int;
  n_registrations int;
begin
  if not exists (select 1 from public.admins where id = auth.uid()) then
    raise exception 'admin only';
  end if;
  if keep_id = remove_id then
    raise exception 'keep_id and remove_id must be different vendors';
  end if;
  if not exists (select 1 from public.vendors where id = keep_id) then
    raise exception 'keep_id is not a real vendor';
  end if;
  if not exists (select 1 from public.vendors where id = remove_id) then
    raise exception 'remove_id is not a real vendor';
  end if;

  -- vendor_categories has a composite primary key (vendor_id, category_id) -
  -- a straight UPDATE would violate it whenever both vendors already share
  -- a category, so insert-and-skip-conflicts, then drop the old rows.
  insert into public.vendor_categories (vendor_id, category_id)
  select keep_id, category_id from public.vendor_categories where vendor_id = remove_id
  on conflict (vendor_id, category_id) do nothing;
  get diagnostics n_categories = row_count;
  delete from public.vendor_categories where vendor_id = remove_id;

  update public.vendor_photos set vendor_id = keep_id where vendor_id = remove_id;
  get diagnostics n_photos = row_count;
  update public.menu_items set vendor_id = keep_id where vendor_id = remove_id;
  get diagnostics n_menu_items = row_count;
  update public.lov_entries set vendor_id = keep_id where vendor_id = remove_id;
  get diagnostics n_listings = row_count;
  update public.lov_entries set hosting_vendor_id = keep_id where hosting_vendor_id = remove_id;
  get diagnostics n_hosted_listings = row_count;
  update public.booths set vendor_id = keep_id where vendor_id = remove_id;
  get diagnostics n_booths = row_count;
  update public.registrations set claimed_by_vendor_id = keep_id where claimed_by_vendor_id = remove_id;
  get diagnostics n_registrations = row_count;

  return jsonb_build_object(
    'categories', n_categories,
    'photos', n_photos,
    'menu_items', n_menu_items,
    'listings', n_listings,
    'hosted_listings', n_hosted_listings,
    'booths', n_booths,
    'registrations', n_registrations
  );
end;
$$ language plpgsql security definer;
