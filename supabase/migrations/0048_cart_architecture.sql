-- CART ARCHITECTURE — phase 1: a real, DB-backed cart that lets a vendor
-- add multiple flat-price tiers (Founding Vendor, Top 10 Category, etc.)
-- before checking out once, paying the $1.00 platform fee a single time
-- instead of once per item. Deliberately does NOT touch the existing
-- single-item checkout tables/columns/constraints in any way that could
-- change its behavior — see the note on the dropped constraint below for
-- the one exception, which is additive/permissive, not a behavior change
-- for the existing flow.

-- A vendor's own pending cart - nothing here is a purchase yet, just what
-- they've picked to buy together. Not for Quick Boost/Top 10 Placement
-- (those need a slot picker per item, out of scope for this phase) -
-- enforced in the app/worker, not here, since a DB check on tier slug
-- would be one more thing to keep in sync with pricing_tiers by hand.
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tier_id uuid not null references public.pricing_tiers (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (vendor_id, tier_id)
);

create index if not exists cart_items_vendor_idx on public.cart_items (vendor_id);

alter table public.cart_items enable row level security;

drop policy if exists "vendor can read own cart" on public.cart_items;
create policy "vendor can read own cart"
  on public.cart_items for select
  using (vendor_id = auth.uid());

drop policy if exists "vendor can add to own cart" on public.cart_items;
create policy "vendor can add to own cart"
  on public.cart_items for insert
  with check (vendor_id = auth.uid());

drop policy if exists "vendor can remove from own cart" on public.cart_items;
create policy "vendor can remove from own cart"
  on public.cart_items for delete
  using (vendor_id = auth.uid());

-- A cart checkout pays for N tiers in ONE Stripe session, which means N
-- registrations rows sharing the same stripe_checkout_session_id - the
-- original "unique" on that column (migration 0001) assumed exactly one
-- registration per session, true for every checkout until now. Dropping
-- it doesn't change how the existing single-item flow behaves: that path
-- has only ever inserted one registration per session by construction,
-- and the webhook's idempotency check already keys off status='paid',
-- not this constraint - so this is purely permissive, opening the door
-- for the new cart path without altering any existing guarantee.
alter table public.registrations drop constraint if exists registrations_stripe_checkout_session_id_key;
create index if not exists registrations_stripe_checkout_session_id_idx on public.registrations (stripe_checkout_session_id);
