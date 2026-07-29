-- Adds "Workshops & Classes" as a real, first-class event category (none
-- existed before — it was being crammed under "Community Event" instead,
-- which is why a craft workshop flyer looked identical to a seasonal
-- festival listing and had no board section of its own in any city).
insert into public.categories (name, slug, icon, sort_order)
values ('Workshops & Classes', 'workshop-class', '🎓', 0)
on conflict (slug) do nothing;

-- Re-tag the existing "Suzy's Crafts" style workshop listing that was
-- filed under Community Event so it shows as its own distinct flyer.
update public.lov_entries
set category_id = (select id from public.categories where slug = 'workshop-class')
where id = 'f5cdadf8-f3e2-4943-b162-0518366e8990'
  and category_id = (select id from public.categories where slug = 'community-event');
