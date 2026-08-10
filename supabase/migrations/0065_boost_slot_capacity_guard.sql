-- P2 stabilization fix (Monday stabilization pass): Quick Vendor Boost /
-- Top 10 Placement slot capacity (MAX_PER_SLOT = 5, worker/index.ts) was
-- only checked once, when a Stripe Checkout session was created -
-- bookedCounts() in worker/index.ts. The actual booking row insert
-- happens later, in the webhook handler, with no re-check. Two vendors
-- who both start checkout while a slot shows 4-of-5 booked can both
-- complete payment and both get inserted, silently overselling the slot
-- past its stated cap.
--
-- This adds a database-level guard so the final insert itself can never
-- exceed the cap, no matter how many checkouts race to it: a
-- pg_advisory_xact_lock keyed on the slot serializes concurrent inserts
-- for THE SAME slot_start (inserts for different slots are unaffected and
-- still run in parallel), so the count check that follows is always
-- accurate, not a stale read from before a concurrent insert landed. The
-- lock is released automatically at the end of each transaction.
--
-- MAX_PER_SLOT here must be kept in sync with worker/index.ts's own
-- MAX_PER_SLOT constant - same already-accepted pattern this codebase
-- uses for PLATFORM_FEE_CENTS (worker/index.ts vs src/lib/fees.ts), since
-- the worker and this migration can't share a single source of truth.
create or replace function public.enforce_boost_slot_capacity()
returns trigger as $$
declare
  max_per_slot constant int := 5;
  current_count int;
begin
  perform pg_advisory_xact_lock(hashtext(new.slot_start::text));

  select count(*) into current_count
  from public.vendor_boost_bookings
  where slot_start = new.slot_start;

  if current_count >= max_per_slot then
    raise exception 'This time slot is fully booked (% of % taken). Please choose a different slot.', current_count, max_per_slot
      using errcode = '23514'; -- check_violation, so the worker's insert failure is easy to recognize
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_boost_slot_capacity on public.vendor_boost_bookings;
create trigger enforce_boost_slot_capacity
  before insert on public.vendor_boost_bookings
  for each row execute function public.enforce_boost_slot_capacity();

-- Note on the one true-collision edge case this can't paper over: if two
-- checkouts for the same last-open slot both complete payment, one insert
-- wins and the other's whole multi-row insert rolls back (standard SQL
-- multi-row INSERT is all-or-nothing), so no partial/duplicate booking is
-- ever possible. The losing webhook call throws, which the existing
-- handler already turns into a 500 - Stripe retries on its own schedule,
-- and the registration stays visibly "pending" (not silently "paid" with
-- no booking) until an admin manually resolves it. The payment itself is
-- never lost (Stripe still holds it); this is an accepted, rare,
-- manual-resolution edge case rather than an automatic reassignment/
-- refund system, which is out of scope for this fix.
