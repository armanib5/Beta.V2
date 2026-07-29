-- Every real vendor account was hardcoded as "daily" (always open) on the
-- Board regardless of whether they'd actually opened yet, so a vendor
-- boosted/featured before their real launch date showed a misleading
-- green "Open Now" badge. This lets a vendor set a real opening date;
-- the Board now only shows Open Now once that date has actually arrived.
alter table public.vendors add column if not exists opens_at date;
