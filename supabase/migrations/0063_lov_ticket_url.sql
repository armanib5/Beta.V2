-- No ticket-link field existed anywhere for events, even though
-- website_url has existed since migration 0005. Plain nullable column,
-- same shape as website_url - no new RLS needed, lov_entries' existing
-- public-read / admin-write policies (migration 0004/0008) already cover it.
alter table public.lov_entries add column if not exists ticket_url text;
