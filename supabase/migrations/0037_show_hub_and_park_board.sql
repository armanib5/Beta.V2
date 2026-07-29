-- SHOW HUB: a distinct hub_type for theaters/centers hosting shows,
-- separate from the generic "hosting" hub used for a restaurant/bar
-- hosting someone else's one-off event (Tony & Alba's + Suzy's
-- workshop). Lets the Board/Map label these differently (Show Hub vs
-- Hosted at) and gives the vendor dashboard's hub-type picker a real
-- 4th option.
alter table public.vendors drop constraint if exists vendors_hub_type_check;
alter table public.vendors add constraint vendors_hub_type_check
  check (hub_type in ('vendor', 'menu', 'hosting', 'show'));

update public.vendors set hub_type = 'show'
where id in (
  '2860ce9f-7173-48ba-9b6f-25a607bade99', -- Montgomery Theater
  'c92d33f5-29b3-402c-8110-4462a9956cfe', -- Hammer Theatre Center
  '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73', -- San Jose Improv
  '00a31bee-7a08-40cd-95f5-142cccadb708', -- San Jose Center for the Performing Arts
  '54dc33e1-85aa-4978-9ed2-bebdecd33148', -- California Theatre
  'cea14f1e-28b1-457b-8af6-50bd51046183', -- San Jose Civic
  '09488ec8-1240-4476-ac9e-67966d72506c', -- SAP Center
  'c8cca3da-43ec-45d5-8f68-48490b63d156', -- The Ritz
  '60b84269-ff00-4445-af23-236222cfead4', -- San Jose Museum of Art
  '8f85c856-dc41-4a30-8aa7-70d38df4cbb2', -- The Tech Interactive
  '1f09f4f0-0aca-471b-9ffc-c1bcdf38a021'  -- City Lights Theater Company
);

-- PARK EVENTS: a park isn't a business that "hosts" in the vendor-hub
-- sense — it's a public place, so these don't get a Host Hub account.
-- Instead they get routed straight to the Parks board via a real
-- category, same as a farmers market routes to Market via its category.
insert into public.categories (name, slug, icon, sort_order)
values ('Park Event', 'park-event', '🌳', 0)
on conflict (slug) do nothing;

update public.lov_entries
set category_id = (select id from public.categories where slug = 'park-event')
where name in (
  'Starlight Saturdays Outdoor Movies',
  'Los Calderones w/ DJ Leydis (FREE LATIN MUSIC CONCERT)',
  'Swades - India''s Independence Day Celebrations',
  'Silicon Valley PRIDE Festival & Parade 2026'
);
