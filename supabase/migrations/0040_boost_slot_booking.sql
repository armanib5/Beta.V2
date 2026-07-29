-- BOOST SLOT BOOKING: the Quick Boost ($15) and new Top 10 Placement ($30)
-- products now reserve specific 10-minute rotation slots instead of just
-- starting a countdown at purchase time - a vendor can pick which 10-minute
-- window(s) they show up in, and each window is capped at 5 concurrent
-- boosted vendors (checked by a plain row count against this table, no
-- locking needed beyond normal transactional inserts since a handful of
-- rows per slot is not a contention hotspot).
--
-- This is deliberately a separate table from vendors.boost_active_until
-- (left in place, just unused going forward) rather than reusing it,
-- because a slot can be scheduled for later - "currently boosted" now
-- means "has a booking row whose [slot_start, slot_end) covers now()",
-- computed at read time by the Directory/Map/Dashboard, not a single
-- flag set once at purchase.
create table if not exists public.vendor_boost_bookings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tier_id uuid references public.pricing_tiers (id),
  registration_id uuid references public.registrations (id),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists vendor_boost_bookings_slot_idx on public.vendor_boost_bookings (slot_start);
create index if not exists vendor_boost_bookings_vendor_idx on public.vendor_boost_bookings (vendor_id);

alter table public.vendor_boost_bookings enable row level security;

-- Public read so the Directory/Map/vendor dashboard can compute "who's
-- boosted right now" and "which slots are already full" directly - no
-- vendor-identifying data here beyond vendor_id, which is already public
-- on every active vendor's own profile anyway. Only the webhook (service
-- role, bypasses RLS) ever writes a row.
drop policy if exists "boost bookings are publicly readable" on public.vendor_boost_bookings;
create policy "boost bookings are publicly readable"
  on public.vendor_boost_bookings for select
  using (true);

-- TOP 10 PLACEMENT ($30/30-min) - a third, separate boost product
-- alongside the existing $15/20-min Quick Boost and the permanent $50/$100
-- tiers. Same is_top10/is_founding = false as Quick Boost: short-term
-- boosts never touch the permanent badge flags.
insert into public.pricing_tiers (name, slug, description, price_cents, is_top10, is_founding, is_active, sort_order)
values (
  'Top 10 Placement',
  'top10-30min',
  '30 minutes of continuous Top 10 gold badge + sorted-to-top placement, starting immediately.',
  3000,
  false,
  false,
  true,
  102
)
on conflict (slug) do nothing;
