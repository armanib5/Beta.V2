-- The Silicon Valley Mariachi Festival (2026-07-12) only ever existed as
-- hardcoded demo content in the static Board/Map JS files (never a real
-- Supabase row), so removing it from those files - since it's long over -
-- would have erased it with no trace anywhere, including Notes & History.
-- This gives it one real, permanent, already-archived lov_entries record
-- so it stays searchable/reviewable (the actual first event tested in
-- this admin) without showing up as live anywhere on the public site.
insert into public.lov_entries (type, name, event_date, location, lat, lng, category_id, status, details)
values (
  'event',
  'Silicon Valley Mariachi Festival',
  '2026-07-12',
  'Plaza de Cesar Chavez, San Jose, CA 95113',
  37.3323, -121.8897,
  (select id from public.categories where slug = 'cultural-festival'),
  'archived',
  'Mariachi Festival at Plaza de Cesar Chavez, 1-8pm - live music with vendors along the street. First event tested in this admin.'
);
