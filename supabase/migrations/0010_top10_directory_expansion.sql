-- CityPinned v2.0 — expand the directory to cover brick-and-mortar
-- restaurants and bars alongside pop-up vendors, with a tiered "Top 10"
-- display (gold badges / highlighted section per category).
--
-- Reuses `vendors` rather than a new parallel table — a restaurant/bar is
-- structurally a vendor (name, contact, location, logo, category tags)
-- with a few extra fields, and `is_top10` already exists on this table
-- from the original schema, so this migration extends it rather than
-- duplicating it as `is_top_10`.

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

-- lov_entries (events + guest listings) get the same tier field, so a
-- seeded/guest listing can also be marked Top 10 / Featured without
-- needing a full paid vendor account.
alter table public.lov_entries
  add column if not exists category_tier text not null default 'standard'
    check (category_tier in ('top_10', 'featured', 'standard'));
