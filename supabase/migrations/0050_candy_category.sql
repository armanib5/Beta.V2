-- V2 iPad testing (candy shop scenario) found no Candy/Sweets category
-- exists among the vendor-facing tags. Grouped next to the other food
-- categories (after Produce) rather than appended at the end, so the
-- sort_order of everything after it shifts by one - a pure ordering
-- data change, nothing hardcodes these integers elsewhere.
update public.categories set sort_order = sort_order + 1
where slug in ('artisan-crafts', 'jewelry', 'apparel', 'beauty-wellness', 'other');

insert into public.categories (name, slug, icon, sort_order)
values ('Candy & Sweets', 'candy-sweets', '🍬', 6)
on conflict (slug) do nothing;
