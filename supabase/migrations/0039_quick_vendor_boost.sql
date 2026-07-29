-- QUICK VENDOR BOOST: a $15, 20-minute, parallel-friendly boost - distinct
-- from the existing $50/$100 Founding Vendor / Top 10 Category tiers.
-- Deliberately its own column rather than reusing is_top10/boost_expires_at
-- (which drive the permanent gold-badge tiers) - a $15 vendor buying 20
-- minutes of visibility should never be indistinguishable from a vendor who
-- paid $100 for a permanent Top 10 badge, and multiple vendors can be
-- boosted at once (checked with a plain "> now()" comparison, no queue/lock
-- needed since boosts don't contend for a shared slot).
alter table public.vendors
  add column if not exists boost_active_until timestamptz;

create index if not exists vendors_boost_active_until_idx
  on public.vendors (boost_active_until)
  where boost_active_until is not null;

insert into public.pricing_tiers (name, slug, description, price_cents, is_top10, is_founding, is_active, sort_order)
values (
  'Vendor Boost',
  'vendor-boost',
  '20 minutes of boosted visibility (gold badge, sorted to the top) on the Map and Directory.',
  1500,
  false,
  false,
  true,
  100
)
on conflict (slug) do nothing;
