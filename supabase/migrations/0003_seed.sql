-- CityPinned v2.0 — starter categories + founding-vendor pricing tiers.
-- Safe to re-run (idempotent on the unique slug/name columns).

insert into public.categories (name, slug, icon, sort_order) values
  ('Home Cook',        'home-cook',        '🍲', 1),
  ('Baker',            'baker',            '🍰', 2),
  ('Coffee & Tea',     'coffee-tea',       '☕', 3),
  ('Food Truck',       'food-truck',       '🚚', 4),
  ('Produce',          'produce',          '🥬', 5),
  ('Artisan Crafts',   'artisan-crafts',   '🎨', 6),
  ('Jewelry',          'jewelry',          '💍', 7),
  ('Apparel',          'apparel',          '👕', 8),
  ('Beauty & Wellness','beauty-wellness',  '💆', 9),
  ('Other',            'other',            '✨', 10)
on conflict (slug) do nothing;

insert into public.pricing_tiers
  (name, slug, description, price_cents, is_top10, is_founding, max_slots, sort_order)
values
  (
    'Founding Vendor',
    'founding-vendor',
    'Lock in a permanent CityPinned profile at the early-bird rate. Includes the Founding Vendor badge and auto-migration into Version 3.',
    5000,
    false,
    true,
    null,
    1
  ),
  (
    'Top 10 Category',
    'top10-category',
    'Everything in Founding Vendor, plus featured placement as one of the first 10 vendors in your category with a gold Top 10 badge.',
    10000,
    true,
    true,
    10,
    2
  )
on conflict (slug) do nothing;
