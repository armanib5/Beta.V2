-- CityPinned v2.0 — recurring LOV entries (farmers markets, weekly/monthly
-- series) that don't have one fixed `event_date`. Rather than fabricating
-- specific occurrence dates, these get a human-readable `recurrence`
-- string (e.g. "Wednesdays 9:00 AM-1:30 PM, May-Nov") and an optional
-- `website_url` back to the organizer/vendor directory.

alter table public.lov_entries
  add column if not exists recurrence text,
  add column if not exists website_url text;

-- The original `unique (type, name, event_date)` constraint doesn't dedupe
-- recurring rows (event_date is null for all of them — Postgres treats
-- NULL as distinct from NULL), so re-seeding would insert duplicates every
-- run. Replace it with a unique index over a generated column that maps
-- null dates to a sentinel, so (type, name) alone dedupes recurring rows
-- while one-off dated events still dedupe per date.
alter table public.lov_entries
  drop constraint if exists lov_entries_type_name_event_date_key;

alter table public.lov_entries
  add column if not exists event_date_key date
    generated always as (coalesce(event_date, '9999-12-31'::date)) stored;

create unique index if not exists lov_entries_dedupe_key
  on public.lov_entries (type, name, event_date_key);
