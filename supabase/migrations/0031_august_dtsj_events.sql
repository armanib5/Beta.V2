-- Bulk-adds the August 2026 DTSJ calendar the user pasted in. Skips
-- everything that's already seeded (Downtown Farmers Market, El
-- Mercadito, First Fridays, George Lopez, Starlight Saturdays, Motown
-- Mania — all confirmed already present by name+date). Recurring weekly
-- series (trivia nights, karaoke, docent tours, etc.) are consolidated
-- into ONE row each with a recurrence string instead of one row per
-- date, matching how the existing farmers-market-style entries work.
-- Genuinely one-off dated shows/concerts get their own row.
--
-- Categories double as the board section (via LOV_CAT_SLUG_TO_BOARD in
-- app.js): live-show/comedy-show/music-festival/cultural-festival all
-- land on the Theaters board, "bar" lands on Bars & Restaurants,
-- "community-event" lands on Seasonal, "workshop-class" lands on its
-- own Workshops & Classes board.
--
-- Venue/address: only used a specific location when the event title
-- itself named one (The Tech Interactive, Coastal Manor) — everything
-- else uses a generic "Downtown San Jose" location with the DTSJ center
-- point rather than guessing a street address that wasn't provided.

-- force_pending_lov_submission fires on every INSERT regardless of who's
-- running it (it checks auth.uid(), which is null both for a service-role
-- call AND for a plain SQL Editor session — same gotcha hit earlier this
-- session for vendor status) — without disabling it here, all of these
-- would silently land as "pending" and never actually show up anywhere.
alter table public.lov_entries disable trigger force_pending_lov_submission;

-- ---------------------------------------------------------------------
-- RECURRING WEEKLY SERIES
-- ---------------------------------------------------------------------
insert into public.lov_entries (type, name, recurrence, location, lat, lng, category_id, status, details)
values
  ('event', 'Docent-led Public Tours', 'Fridays–Sundays, 1:00 PM; also Thursdays, 5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'Trivia Mondays', 'Mondays, 7:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Jazz Up Your Monday Night', 'Mondays, 7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Sonic Runway', 'Nightly', 'Plaza de César Chávez, Downtown San Jose', 37.3336, -121.8896, (select id from public.categories where slug = 'community-event'), 'active', 'Public light-and-sound art installation.'),
  ('event', 'Jeopardy Bar League', 'Tuesdays, 5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Live Irish Seisiún', 'Tuesdays, 6:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'King Trivia Night', 'Wednesdays, 7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Trivia Night', 'Wednesdays, 6:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Live Music Wednesdays at Coastal Manor', 'Wednesdays, 7:30 PM', 'Coastal Manor, Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Free Play Thursdays', 'Thursdays, 5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', '$9 Before Happy Hour', 'Thursdays–Saturdays, 4:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Karaoke Night', 'Sundays, 7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'LASERS! Galactic Odyssey', 'Fridays & Saturdays, evenings', 'The Tech Interactive', 37.3305, -121.8907, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Laser Pink Floyd', 'Fridays & Saturdays, evenings', 'The Tech Interactive', 37.3305, -121.8907, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'PDN South Bay/Peninsula Drop off', 'Monthly, 1st Monday, 12:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'other'), 'active', null);

-- ---------------------------------------------------------------------
-- ONE-OFF DATED SHOWS/CONCERTS/EVENTS
-- ---------------------------------------------------------------------
insert into public.lov_entries (type, name, event_date, end_date, recurrence, location, lat, lng, category_id, status, details)
values
  ('event', 'Bank of America Museums on Us Weekend', '2026-08-01', null, '11:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'Legally Blonde', '2026-08-01', '2026-08-02', 'Matinee & evening shows', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', 'Aug 1: 2:00 PM & 7:00 PM. Aug 2: 1:00 PM & 6:00 PM.'),
  ('event', 'Candlelight: The Best of Joe Hisaishi', '2026-08-01', null, '5:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Adam Ray: Who Is Me Tour', '2026-08-01', '2026-08-02', '7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'comedy-show'), 'active', null),
  ('event', 'American Pachuco', '2026-08-02', null, '2:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', 'Additional performance Aug 9, 2:00 PM.'),
  ('event', 'Nick Cave & The Bad Seeds', '2026-08-02', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'STEM Summer CAMP at The Tech: Planet Protectors', '2026-08-03', '2026-08-08', '9:00 AM', 'The Tech Interactive', 37.3305, -121.8907, (select id from public.categories where slug = 'workshop-class'), 'active', null),
  ('event', 'Cojo Feliz', '2026-08-06', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Jason Joshua', '2026-08-06', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'San José Spotlight presents PolitiBeat 2026', '2026-08-07', null, '9:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'Gospel Brunch Buffet', '2026-08-09', null, '10:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'NAFA Red Carpet and Marathi Film Festival', '2026-08-09', null, '11:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'cultural-festival'), 'active', null),
  ('event', 'Open Mic', '2026-08-11', null, '9:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'bar'), 'active', null),
  ('event', 'Beth''s Beach Bunny', '2026-08-11', null, '7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Moby', '2026-08-11', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Beyond Global Spartan Welcome: International Graduate Student Panel & Networking Event', '2026-08-13', null, '2:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'Swades - India''s Independence Day Celebrations', '2026-08-15', null, '2:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'cultural-festival'), 'active', null),
  ('event', 'Gasolina Party', '2026-08-15', null, '9:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'The Purple Ones w/ Michael Jackson vs. Prince DJ Set (FREE PRINCE TRIBUTE CONCERT)', '2026-08-16', null, '2:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', 'Also 4:00 PM set.'),
  ('event', 'IV and the Strange Band / Clownvis', '2026-08-18', null, '7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Omar Courtz', '2026-08-19', null, '6:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Candlelight: The Best of Hans Zimmer', '2026-08-21', null, '4:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Girls Gone Bible Revival Tour', '2026-08-21', null, '5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Candlelight: Coldplay & Imagine Dragons', '2026-08-21', null, '6:45 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Wincent Weiss', '2026-08-21', null, '7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', '''90s Corridos Tour', '2026-08-21', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Chris Lake', '2026-08-22', null, '2:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Wobbleland 2026', '2026-08-22', null, '5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'music-festival'), 'active', null),
  ('event', 'Marc Maron: Yammering Into The Void Tour', '2026-08-22', null, '6:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'comedy-show'), 'active', null),
  ('event', 'Ronstadt Revolution – Featuring Natalie Amaya', '2026-08-22', null, '7:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Undertale Symphony', '2026-08-23', null, '3:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Natalie and James Thompson Gallery: Pictorial Arts Faculty Exhibition', '2026-08-25', null, '5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'community-event'), 'active', null),
  ('event', 'Nonpoint, Spineshank', '2026-08-26', null, '6:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Hermanos Espinoza', '2026-08-27', null, '8:00 AM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Mamamoo', '2026-08-27', null, '5:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Content Pick-Up Party: 18.4 Profiles', '2026-08-27', null, '6:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'other'), 'active', null),
  ('event', 'Sonu Nigam', '2026-08-29', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Gary Owen: No Hard Feelings Tour', '2026-08-29', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'comedy-show'), 'active', null),
  ('event', 'Silicon Valley PRIDE Festival & Parade 2026', '2026-08-29', null, '9:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'cultural-festival'), 'active', 'Listed as "Pending" on the source calendar — confirm date before promoting.'),
  ('event', 'Golden Girls Drag Brunch', '2026-08-30', null, '1:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'Los Calderones w/ DJ Leydis (FREE LATIN MUSIC CONCERT)', '2026-08-30', null, '2:30 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null),
  ('event', 'El Tri – Adicto al Rocanrol', '2026-08-30', null, '8:00 PM', 'Downtown San Jose', 37.3382, -121.8863, (select id from public.categories where slug = 'live-show'), 'active', null);

alter table public.lov_entries enable trigger force_pending_lov_submission;

-- Existing San Jose Jazz Summer Fest 2026 entry only had a single date
-- (Aug 7); the pasted calendar shows it actually running Fri–Sun at the
-- Montgomery Theater (Aug 7-9) with many per-stage set times that aren't
-- worth a row each — extending the existing entry's span instead of
-- creating dozens of near-duplicate "San Jose Jazz Summer Fest" rows.
update public.lov_entries
set end_date = '2026-08-09'
where name = 'San Jose Jazz Summer Fest 2026' and event_date = '2026-08-07';
