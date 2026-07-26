-- CityPinned v2.0 — multi-day LOV events (festivals/fairs spanning several
-- days) get an optional `end_date` rather than being squashed onto a
-- single day. `event_date` remains the start date for one-off events; the
-- calendar treats a day as "in range" when event_date <= day <= end_date.

alter table public.lov_entries
  add column if not exists end_date date;

alter table public.lov_entries
  drop constraint if exists lov_entries_end_date_check;

alter table public.lov_entries
  add constraint lov_entries_end_date_check
    check (end_date is null or event_date is null or end_date >= event_date);
