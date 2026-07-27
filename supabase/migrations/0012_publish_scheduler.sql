-- CityPinned v2.0 — auto-publish scheduler: an event/listing can be
-- created now but stay hidden from the public until a scheduled date,
-- instead of going live the instant an admin saves it.
alter table public.lov_entries
  add column if not exists publish_at timestamptz;

create index if not exists lov_entries_publish_at_idx on public.lov_entries (publish_at);
