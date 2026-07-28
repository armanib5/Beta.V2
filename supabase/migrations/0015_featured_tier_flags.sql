-- CityPinned v2.0 — Featured/Top 10 tier flags, and the two account
-- upgrades requested with them.
--
-- `is_top10` (vendors) and `booth_tier` (lov_entries) already exist and
-- stay the source of truth for the gold "Top 10" badge everywhere it
-- already renders. This migration adds `category_tier` (a "Featured"
-- middle tier between Top 10 and standard) and `is_featured` to BOTH
-- tables, since the request needs it on Suzy's event (an lov_entries
-- row) as well as Poppy's vendor account, and lov_entries never got
-- category_tier in the earlier (still-unmerged) Bites & Drinks branch.

alter table public.vendors
  add column if not exists category_tier text not null default 'standard'
    check (category_tier in ('top_10', 'featured', 'standard')),
  add column if not exists is_featured boolean not null default false;

alter table public.lov_entries
  add column if not exists category_tier text not null default 'standard'
    check (category_tier in ('top_10', 'featured', 'standard')),
  add column if not exists is_featured boolean not null default false;

-- category_tier/is_featured grant the same directory prominence is_top10
-- does, so they need the same self-elevation guard the trigger already
-- applies to is_top10/is_founding_vendor/tier_id/status.
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

-- ---------------------------------------------------------------------------
-- Poppy & Claro: Top 10 / Featured, all premium flags, free (no charge —
-- an admin comp, same mechanism as every other tier award in this app).
-- Trigger above blocks a plain UPDATE from a non-admin session, but this
-- runs as you (the admin) pasting into the SQL editor, which bypasses
-- RLS/triggers entirely as the table owner — no disable-trigger dance
-- needed here.
-- ---------------------------------------------------------------------------
update public.vendors
  set is_top10 = true,
      category_tier = 'top_10',
      is_featured = true,
      tier_id = (select id from public.pricing_tiers where is_top10 = true limit 1)
  where slug = 'poppy';

-- ---------------------------------------------------------------------------
-- Suzy Berlant's craft workshop: Top 10 / Featured, gold pin, free.
-- ---------------------------------------------------------------------------
update public.lov_entries
  set booth_tier = 'top',
      category_tier = 'top_10',
      is_featured = true
  where id = 'f5cdadf8-f3e2-4943-b162-0518366e8990';
