-- CityPinned v2.0 — expand the directory to cover brick-and-mortar
-- restaurants and bars alongside pop-up vendors and events, with a tiered
-- "Top 10 / Featured / Standard" display per category.
--
-- Reuses `vendors` rather than a new parallel table — a restaurant/bar is
-- structurally a vendor (name, contact, location, logo, category tags,
-- instagram_handle already exists) with a few extra fields. `is_top10`
-- already exists and stays the single source of truth for the gold "Top
-- 10" badge used across the app (dashboard, directory, board); this
-- migration adds `category_tier` alongside it only to add a "Featured"
-- middle tier between Top 10 and standard, not to duplicate the boolean.

alter table public.vendors
  add column if not exists entity_type text not null default 'vendor'
    check (entity_type in ('vendor', 'restaurant', 'bar')),
  add column if not exists category_tier text not null default 'standard'
    check (category_tier in ('top_10', 'featured', 'standard')),
  add column if not exists operating_hours jsonb,
  add column if not exists happy_hour_specials text,
  add column if not exists menu_url text;

create index if not exists vendors_entity_type_idx on public.vendors (entity_type);
create index if not exists vendors_category_tier_idx on public.vendors (category_tier);

-- lov_entries (events + guest vendor listings) get the same tier field, so
-- a seeded/guest listing can be marked Top 10 / Featured without needing a
-- full paid vendor account.
alter table public.lov_entries
  add column if not exists category_tier text not null default 'standard'
    check (category_tier in ('top_10', 'featured', 'standard'));

-- `category_tier` grants the same kind of directory prominence `is_top10`
-- does, so it needs the same self-elevation guard: a vendor's own
-- "update own profile" policy has no column restriction, and the existing
-- protect_vendor_privileged_fields trigger (migration 0007) didn't know
-- about this column yet. Extend it rather than duplicate it.
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
    new.category_tier := 'standard';
  elsif tg_op = 'UPDATE' then
    new.status := old.status;
    new.is_founding_vendor := old.is_founding_vendor;
    new.is_top10 := old.is_top10;
    new.tier_id := old.tier_id;
    new.category_tier := old.category_tier;
  end if;

  return new;
end;
$$ language plpgsql security definer;
