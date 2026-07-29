-- Creates a real Host Hub vendor account for every venue behind the
-- August DTSJ calendar (bars hosting trivia/karaoke/live music, theaters
-- hosting shows) so each venue has its OWN flyer on the board, and links
-- every recurring/one-off event to its real host via hosting_vendor_id -
-- same pattern as Tony & Alba's hosting Suzy's workshop, applied broadly.

insert into public.vendors (id, slug, business_name, contact_email, status, entity_type, hub_type, lat, lng)
values
  ('63a01471-6513-477e-98ee-67af4f566a3d', 'nomikai', 'Nomikai', 'nomikai@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3357, -121.8907),
  ('cc82d6c1-5a3f-4e50-9542-470a15210eb8', 'oflahertys', 'O''Flaherty''s Irish Pub', 'oflahertys@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3376, -121.893),
  ('b0159d9d-ff99-4edc-8019-92d4f4d990b7', 'three-sisters', 'Three Sisters Whiskey Bar', 'three-sisters@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3383, -121.8927),
  ('fbee8b27-c739-4aad-8826-c2fab2c2bb88', 'dr-funk', 'Dr. Funk', 'dr-funk@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3377, -121.8929),
  ('839e5908-4cfa-4b9b-ad23-49875f68df46', 'five-points', 'Five Points', 'five-points@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3369, -121.8927),
  ('77c67a18-a2fc-4bf0-b528-7b62309b8803', 'sofa-market', 'SoFA Market', 'sofa-market@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3298, -121.8907),
  ('b9fc47aa-40a8-4eac-bd00-cd49996f33f9', 'sj-marriott', 'San Jose Marriott (Coastal Manor)', 'sj-marriott@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3311, -121.8899),
  ('dfce8ff4-7318-41fd-bfca-99d6b733b6d6', 'miniboss', 'MINIBOSS', 'miniboss@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3379, -121.8888),
  ('124a215f-8695-4384-a4db-c374698e9889', 'san-pedro-square-market', 'San Pedro Square Market', 'san-pedro-square-market@vendor.citypinned.app', 'pending', 'bar', 'hosting', 37.3378, -121.8931),
  ('2860ce9f-7173-48ba-9b6f-25a607bade99', 'montgomery-theater', 'Montgomery Theater', 'montgomery-theater@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3311, -121.8907),
  ('c92d33f5-29b3-402c-8110-4462a9956cfe', 'hammer-theatre', 'Hammer Theatre Center', 'hammer-theatre@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3336, -121.8879),
  ('4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73', 'sj-improv', 'San Jose Improv', 'sj-improv@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3355, -121.8908),
  ('00a31bee-7a08-40cd-95f5-142cccadb708', 'sj-center-performing-arts', 'San Jose Center for the Performing Arts', 'sj-center-performing-arts@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3308, -121.8916),
  ('54dc33e1-85aa-4978-9ed2-bebdecd33148', 'california-theatre', 'California Theatre', 'california-theatre@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3305, -121.8896),
  ('cea14f1e-28b1-457b-8af6-50bd51046183', 'sj-civic', 'San Jose Civic', 'sj-civic@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3305, -121.893),
  ('09488ec8-1240-4476-ac9e-67966d72506c', 'sap-center', 'SAP Center', 'sap-center@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3327, -121.9007),
  ('c8cca3da-43ec-45d5-8f68-48490b63d156', 'the-ritz', 'The Ritz', 'the-ritz@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.33, -121.8908),
  ('60b84269-ff00-4445-af23-236222cfead4', 'sj-museum-of-art', 'San Jose Museum of Art', 'sj-museum-of-art@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3327, -121.8895),
  ('8f85c856-dc41-4a30-8aa7-70d38df4cbb2', 'the-tech-interactive', 'The Tech Interactive', 'the-tech-interactive@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3305, -121.8907),
  ('1f09f4f0-0aca-471b-9ffc-c1bcdf38a021', 'city-lights-theater', 'City Lights Theater Company', 'city-lights-theater@vendor.citypinned.app', 'pending', 'vendor', 'hosting', 37.3298, -121.8869);

alter table public.vendors disable trigger protect_vendor_privileged_fields;
update public.vendors set status = 'active' where id in ('63a01471-6513-477e-98ee-67af4f566a3d', 'cc82d6c1-5a3f-4e50-9542-470a15210eb8', 'b0159d9d-ff99-4edc-8019-92d4f4d990b7', 'fbee8b27-c739-4aad-8826-c2fab2c2bb88', '839e5908-4cfa-4b9b-ad23-49875f68df46', '77c67a18-a2fc-4bf0-b528-7b62309b8803', 'b9fc47aa-40a8-4eac-bd00-cd49996f33f9', 'dfce8ff4-7318-41fd-bfca-99d6b733b6d6', '124a215f-8695-4384-a4db-c374698e9889', '2860ce9f-7173-48ba-9b6f-25a607bade99', 'c92d33f5-29b3-402c-8110-4462a9956cfe', '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73', '00a31bee-7a08-40cd-95f5-142cccadb708', '54dc33e1-85aa-4978-9ed2-bebdecd33148', 'cea14f1e-28b1-457b-8af6-50bd51046183', '09488ec8-1240-4476-ac9e-67966d72506c', 'c8cca3da-43ec-45d5-8f68-48490b63d156', '60b84269-ff00-4445-af23-236222cfead4', '8f85c856-dc41-4a30-8aa7-70d38df4cbb2', '1f09f4f0-0aca-471b-9ffc-c1bcdf38a021');
alter table public.vendors enable trigger protect_vendor_privileged_fields;

insert into public.vendor_categories (vendor_id, category_id)
values
  ('63a01471-6513-477e-98ee-67af4f566a3d', (select id from public.categories where slug = 'bar')),
  ('cc82d6c1-5a3f-4e50-9542-470a15210eb8', (select id from public.categories where slug = 'bar')),
  ('b0159d9d-ff99-4edc-8019-92d4f4d990b7', (select id from public.categories where slug = 'bar')),
  ('fbee8b27-c739-4aad-8826-c2fab2c2bb88', (select id from public.categories where slug = 'bar')),
  ('839e5908-4cfa-4b9b-ad23-49875f68df46', (select id from public.categories where slug = 'bar')),
  ('77c67a18-a2fc-4bf0-b528-7b62309b8803', (select id from public.categories where slug = 'bar')),
  ('b9fc47aa-40a8-4eac-bd00-cd49996f33f9', (select id from public.categories where slug = 'bar')),
  ('dfce8ff4-7318-41fd-bfca-99d6b733b6d6', (select id from public.categories where slug = 'bar')),
  ('124a215f-8695-4384-a4db-c374698e9889', (select id from public.categories where slug = 'bar')),
  ('2860ce9f-7173-48ba-9b6f-25a607bade99', (select id from public.categories where slug = 'live-show')),
  ('c92d33f5-29b3-402c-8110-4462a9956cfe', (select id from public.categories where slug = 'live-show')),
  ('4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73', (select id from public.categories where slug = 'live-show')),
  ('00a31bee-7a08-40cd-95f5-142cccadb708', (select id from public.categories where slug = 'live-show')),
  ('54dc33e1-85aa-4978-9ed2-bebdecd33148', (select id from public.categories where slug = 'live-show')),
  ('cea14f1e-28b1-457b-8af6-50bd51046183', (select id from public.categories where slug = 'live-show')),
  ('09488ec8-1240-4476-ac9e-67966d72506c', (select id from public.categories where slug = 'live-show')),
  ('c8cca3da-43ec-45d5-8f68-48490b63d156', (select id from public.categories where slug = 'live-show')),
  ('60b84269-ff00-4445-af23-236222cfead4', (select id from public.categories where slug = 'live-show')),
  ('8f85c856-dc41-4a30-8aa7-70d38df4cbb2', (select id from public.categories where slug = 'live-show')),
  ('1f09f4f0-0aca-471b-9ffc-c1bcdf38a021', (select id from public.categories where slug = 'live-show'));

-- Link every event/flyer to its real host venue.
update public.lov_entries set hosting_vendor_id = '63a01471-6513-477e-98ee-67af4f566a3d' where name = '$9 Before Happy Hour';
update public.lov_entries set hosting_vendor_id = 'cc82d6c1-5a3f-4e50-9542-470a15210eb8' where name = 'Karaoke Night';
update public.lov_entries set hosting_vendor_id = 'cc82d6c1-5a3f-4e50-9542-470a15210eb8' where name = 'Trivia Night';
update public.lov_entries set hosting_vendor_id = 'cc82d6c1-5a3f-4e50-9542-470a15210eb8' where name = 'Live Irish Seisiún';
update public.lov_entries set hosting_vendor_id = 'b0159d9d-ff99-4edc-8019-92d4f4d990b7' where name = 'Jeopardy Bar League';
update public.lov_entries set hosting_vendor_id = 'fbee8b27-c739-4aad-8826-c2fab2c2bb88' where name = 'Trivia Mondays';
update public.lov_entries set hosting_vendor_id = '839e5908-4cfa-4b9b-ad23-49875f68df46' where name = 'Jazz Up Your Monday Night';
update public.lov_entries set hosting_vendor_id = '77c67a18-a2fc-4bf0-b528-7b62309b8803' where name = 'King Trivia Night';
update public.lov_entries set hosting_vendor_id = 'b9fc47aa-40a8-4eac-bd00-cd49996f33f9' where name = 'Live Music Wednesdays at Coastal Manor';
update public.lov_entries set hosting_vendor_id = 'dfce8ff4-7318-41fd-bfca-99d6b733b6d6' where name = 'Free Play Thursdays';
update public.lov_entries set hosting_vendor_id = '124a215f-8695-4384-a4db-c374698e9889' where name = 'Live Music at San Pedro Square Market';
update public.lov_entries set hosting_vendor_id = '2860ce9f-7173-48ba-9b6f-25a607bade99' where name = 'Legally Blonde';
update public.lov_entries set hosting_vendor_id = '2860ce9f-7173-48ba-9b6f-25a607bade99' where name = 'Ronstadt Revolution – Featuring Natalie Amaya';
update public.lov_entries set hosting_vendor_id = '2860ce9f-7173-48ba-9b6f-25a607bade99' where name = 'San Jose Jazz Summer Fest 2026';
update public.lov_entries set hosting_vendor_id = 'c92d33f5-29b3-402c-8110-4462a9956cfe' where name = 'Candlelight: The Best of Joe Hisaishi';
update public.lov_entries set hosting_vendor_id = 'c92d33f5-29b3-402c-8110-4462a9956cfe' where name = 'Candlelight: The Best of Hans Zimmer';
update public.lov_entries set hosting_vendor_id = 'c92d33f5-29b3-402c-8110-4462a9956cfe' where name = 'Candlelight: Coldplay & Imagine Dragons';
update public.lov_entries set hosting_vendor_id = 'c92d33f5-29b3-402c-8110-4462a9956cfe' where name = 'San José Spotlight presents PolitiBeat 2026';
update public.lov_entries set hosting_vendor_id = 'c92d33f5-29b3-402c-8110-4462a9956cfe' where name = 'Plant Bingo';
update public.lov_entries set hosting_vendor_id = '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73' where name = 'Adam Ray: Who Is Me Tour';
update public.lov_entries set hosting_vendor_id = '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73' where name = 'Open Mic';
update public.lov_entries set hosting_vendor_id = '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73' where name = 'Cojo Feliz';
update public.lov_entries set hosting_vendor_id = '4dcb4f4b-de57-4307-a8d8-cf3cf9cb4f73' where name = 'Gary Owen: No Hard Feelings Tour';
update public.lov_entries set hosting_vendor_id = '00a31bee-7a08-40cd-95f5-142cccadb708' where name = 'Nick Cave & The Bad Seeds';
update public.lov_entries set hosting_vendor_id = '00a31bee-7a08-40cd-95f5-142cccadb708' where name = 'Wincent Weiss';
update public.lov_entries set hosting_vendor_id = '54dc33e1-85aa-4978-9ed2-bebdecd33148' where name = 'NAFA Red Carpet and Marathi Film Festival';
update public.lov_entries set hosting_vendor_id = '54dc33e1-85aa-4978-9ed2-bebdecd33148' where name = 'Girls Gone Bible Revival Tour';
update public.lov_entries set hosting_vendor_id = '54dc33e1-85aa-4978-9ed2-bebdecd33148' where name = 'Marc Maron: Yammering Into The Void Tour';
update public.lov_entries set hosting_vendor_id = '54dc33e1-85aa-4978-9ed2-bebdecd33148' where name = 'Undertale Symphony';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'The Beths & Beach Bunny';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'Moby';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'Omar Courtz';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'Chris Lake';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'Wobbleland 2026';
update public.lov_entries set hosting_vendor_id = 'cea14f1e-28b1-457b-8af6-50bd51046183' where name = 'El Tri – Adicto al Rocanrol';
update public.lov_entries set hosting_vendor_id = '09488ec8-1240-4476-ac9e-67966d72506c' where name = '''90s Corridos Tour';
update public.lov_entries set hosting_vendor_id = '09488ec8-1240-4476-ac9e-67966d72506c' where name = 'Hermanos Espinoza';
update public.lov_entries set hosting_vendor_id = '09488ec8-1240-4476-ac9e-67966d72506c' where name = 'Mamamoo';
update public.lov_entries set hosting_vendor_id = '09488ec8-1240-4476-ac9e-67966d72506c' where name = 'Sonu Nigam';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'Jason Joshua';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'Gasolina Party';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'The Purple Ones w/ Michael Jackson vs. Prince DJ Set (FREE PRINCE TRIBUTE CONCERT)';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'IV and the Strange Band / Clownvis';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'Nonpoint, Spineshank';
update public.lov_entries set hosting_vendor_id = 'c8cca3da-43ec-45d5-8f68-48490b63d156' where name = 'Golden Girls Drag Brunch';
update public.lov_entries set hosting_vendor_id = '60b84269-ff00-4445-af23-236222cfead4' where name = 'Bank of America Museums on Us Weekend';
update public.lov_entries set hosting_vendor_id = '60b84269-ff00-4445-af23-236222cfead4' where name = 'Docent-led Public Tours';
update public.lov_entries set hosting_vendor_id = '60b84269-ff00-4445-af23-236222cfead4' where name = 'Content Pick-Up Party: 18.4 Profiles';
update public.lov_entries set hosting_vendor_id = '8f85c856-dc41-4a30-8aa7-70d38df4cbb2' where name = 'LASERS! Galactic Odyssey';
update public.lov_entries set hosting_vendor_id = '8f85c856-dc41-4a30-8aa7-70d38df4cbb2' where name = 'Laser Pink Floyd';
update public.lov_entries set hosting_vendor_id = '8f85c856-dc41-4a30-8aa7-70d38df4cbb2' where name = 'STEM Summer CAMP at The Tech: Planet Protectors';
update public.lov_entries set hosting_vendor_id = '1f09f4f0-0aca-471b-9ffc-c1bcdf38a021' where name = 'PDN South Bay/Peninsula Drop off';
