-- Hotel didn't exist as a real category at all - only a Map-only static,
-- disconnected pin (the hardcoded "Signia by Hilton" marker in
-- public/map/data/places.js) with zero Board presence and zero connection
-- to lov_entries/vendors. This adds the real DB category row; the Board
-- and Map category-object/slug-map wiring landed in commit e35a3b9.
insert into public.categories (name, slug, icon, sort_order)
values ('Hotel', 'hotel', '🏨', 103)
on conflict (slug) do nothing;
