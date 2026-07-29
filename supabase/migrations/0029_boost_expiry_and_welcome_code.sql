-- Optional boost/feature expiry, so the admin approval page can show a
-- countdown for a temporary Top 10/Featured grant instead of only ever
-- being permanent. Null = permanent (unchanged default behavior).
alter table public.vendors add column if not exists boost_expires_at timestamptz;

-- A real, reusable "WELCOME" promo code granting Top 10 Category (the
-- $100 tier) — max_uses left null (unlimited) since this is meant to be
-- handed out broadly, not a single-use test code.
insert into public.promo_codes (code, tier_id, max_uses, is_active)
values ('WELCOME', 'df21714f-3f66-43ef-b906-db743d0373fd', null, true)
on conflict (code) do update set is_active = true, max_uses = null;
