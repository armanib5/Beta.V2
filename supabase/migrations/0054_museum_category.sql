-- V2 cleanup pass: no "Museum" category has ever existed, so the one real
-- museum event (Bank of America Museums on Us Weekend) has been filed
-- under community-event -> Seasonal/Centers on the Board instead. Adds
-- the category and reassigns that specific event to it - id confirmed
-- live before writing this migration, not guessed.
insert into public.categories (name, slug, icon, sort_order)
values ('Museum', 'museum', '🏛️', 102)
on conflict (slug) do nothing;

update public.lov_entries
set category_id = (select id from public.categories where slug = 'museum')
where id = '29ed624a-07ae-4412-9d32-e10c235715c3';
