-- Corrects the placeholder "Downtown San Jose" locations from 0031 with
-- the real venue names/addresses/times just provided, and adds a few
-- events that were in the original paste but got missed the first time
-- (Plant Bingo, the Haberdasher Shows finale, the Scott's Social Club
-- mixer, live music at San Pedro Square Market). Coordinates are
-- reasonable street-level approximations for these DTSJ addresses, not
-- surveyed exact points — same caveat as the rest of the seed data.

alter table public.lov_entries disable trigger force_pending_lov_submission;

-- Bank of America Museums on Us Weekend: actually monthly (1st Sat), not
-- a one-off — convert from a dated row to a recurring one.
update public.lov_entries
set event_date = null, end_date = null,
    recurrence = 'Monthly, 1st Saturday, 11:00 AM – 6:00 PM',
    location = 'San Jose Museum of Art, 110 South Market Street, San Jose, CA 95113',
    lat = 37.3327, lng = -121.8895
where name = 'Bank of America Museums on Us Weekend';

update public.lov_entries
set end_date = '2026-08-03',
    recurrence = '4:00 PM & evening shows, through Aug 3',
    location = 'Montgomery Theater, 271 South Market Street, San Jose, CA 95113',
    lat = 37.3311, lng = -121.8907
where name = 'Legally Blonde';

update public.lov_entries
set location = 'Nomikai, 48 South 1st Street, San Jose, CA 95113', lat = 37.3357, lng = -121.8907
where name = '$9 Before Happy Hour';

update public.lov_entries
set recurrence = '7:30 PM',
    location = 'Hammer Theatre Center, 101 Paseo de San Antonio, San Jose, CA 95113',
    lat = 37.3336, lng = -121.8879
where name = 'Candlelight: The Best of Joe Hisaishi';

update public.lov_entries
set recurrence = '9:00 PM',
    location = 'San Jose Improv, 62 S. Second Street, San Jose, CA 95113',
    lat = 37.3355, lng = -121.8908
where name = 'Adam Ray: Who Is Me Tour';

update public.lov_entries
set location = 'San Jose Stage Company, 490 S 1st St, San Jose, CA 95113', lat = 37.3298, lng = -121.8908
where name = 'American Pachuco';

update public.lov_entries
set location = 'O''Flaherty''s Irish Pub, 25 N San Pedro St, San Jose, CA 95110', lat = 37.3376, lng = -121.8930,
    details = 'Also Mondays, 9:00 PM.'
where name = 'Karaoke Night';

update public.lov_entries
set location = 'San Jose Center for the Performing Arts, 255 Almaden Blvd, San Jose, CA 95113', lat = 37.3308, lng = -121.8916
where name = 'Nick Cave & The Bad Seeds';

update public.lov_entries
set location = 'Rotunda at San Jose City Hall, 200 E Santa Clara St, San Jose, CA 95112', lat = 37.3379, lng = -121.8863
where name = 'Sonic Runway';

update public.lov_entries
set location = 'Five Points, 169 W Santa Clara St, San Jose, CA 95113', lat = 37.3369, lng = -121.8927
where name = 'Jazz Up Your Monday Night';

update public.lov_entries
set location = 'Dr. Funk, 29 N San Pedro St, San Jose, CA 95110', lat = 37.3377, lng = -121.8929
where name = 'Trivia Mondays';

update public.lov_entries
set location = 'Three Sisters Whiskey Bar, 170 W. Saint John St, San Jose, CA 95113', lat = 37.3383, lng = -121.8927
where name = 'Jeopardy Bar League';

update public.lov_entries
set location = 'O''Flaherty''s Irish Pub, 25 N San Pedro St, San Jose, CA 95110', lat = 37.3376, lng = -121.8930
where name = 'Live Irish Seisiún';

update public.lov_entries
set location = 'O''Flaherty''s Irish Pub, 25 N San Pedro St, San Jose, CA 95110', lat = 37.3376, lng = -121.8930
where name = 'Trivia Night';

update public.lov_entries
set location = 'SoFA Market, 387 S 1st Street, San Jose, CA 95113', lat = 37.3298, lng = -121.8907
where name = 'King Trivia Night';

update public.lov_entries
set location = 'San Jose Marriott (Coastal Manor), 301 S. Market Street, San Jose, CA 95113', lat = 37.3311, lng = -121.8899
where name = 'Live Music Wednesdays at Coastal Manor';

update public.lov_entries
set location = 'MINIBOSS, 52 E Santa Clara St, San Jose, CA 95113', lat = 37.3379, lng = -121.8888
where name = 'Free Play Thursdays';

update public.lov_entries
set location = 'San Jose Improv, 62 S Second St, San Jose, CA 95113', lat = 37.3355, lng = -121.8908
where name = 'Cojo Feliz';

update public.lov_entries
set location = 'The Ritz, 400 S 1st Street, San Jose, CA 95113', lat = 37.3300, lng = -121.8908
where name = 'Jason Joshua';

update public.lov_entries
set event_date = '2026-08-30', end_date = null, recurrence = '4:00 PM',
    location = 'St James Park, N 2nd St & E St James St, San Jose, CA 95112', lat = 37.3423, lng = -121.8908,
    details = 'Free concert presented by MACLA / Levitt Pavilion San Jose.'
where name = 'Los Calderones w/ DJ Leydis (FREE LATIN MUSIC CONCERT)';

-- Real venue for the already-seeded Starlight Saturdays series.
update public.lov_entries
set location = 'St James Park, N 2nd St & E St James St, San Jose, CA 95112', lat = 37.3423, lng = -121.8908
where name = 'Starlight Saturdays Outdoor Movies';

-- ---------------------------------------------------------------------
-- Missed the first pass entirely — adding now with full details.
-- ---------------------------------------------------------------------
insert into public.lov_entries (type, name, recurrence, location, lat, lng, category_id, status, details)
values
  ('event', 'Live Music at San Pedro Square Market', '6 nights a week, 6:00 PM – 9:00 PM', 'San Pedro Square Market, 87 N San Pedro St, San Jose, CA 95110', 37.3378, -121.8931, (select id from public.categories where slug = 'bar'), 'active', null);

insert into public.lov_entries (type, name, event_date, recurrence, location, lat, lng, category_id, status, details)
values
  ('event', 'Plant Bingo', '2026-08-04', '6:00 PM', 'Hammer Theatre Center, 101 Paseo De San Antonio Walk, San Jose, CA 95113', 37.3336, -121.8879, (select id from public.categories where slug = 'other'), 'active', 'Play bingo, win plants. Food & drinks available for purchase.'),
  ('event', 'Aug. 5 – Hot August Nights: Scott''s Social Club Mixer', '2026-08-05', '6:00 PM', 'Rotary Summit Center, 7th floor, 88 S 4th St, San Jose, CA 95112', 37.3355, -121.8853, (select id from public.categories where slug = 'community-event'), 'active', 'Private rooftop mixer, 6:00–8:30 PM.'),
  ('event', 'The Haberdasher Shows: Aug 2026 (The Official Summer Fest Pre-Party)', '2026-08-05', '6:00 PM', 'Haberdasher, 43 W San Salvador St, San Jose, CA 95113', 37.3316, -121.8905, (select id from public.categories where slug = 'live-show'), 'active', 'Grand finale of The Haberdasher Shows series, in partnership with San Jose Jazz. Free entry, 21+, 6–10 PM.');

alter table public.lov_entries enable trigger force_pending_lov_submission;
