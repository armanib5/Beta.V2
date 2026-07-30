-- $1.00 platform processing fee, itemized/tracked on every Stripe
-- checkout - the registrations table already IS this project's payment
-- ledger (one row per checkout, amount_cents/stripe_payment_intent_id/
-- paid_at/status already exist), so this extends it rather than
-- standing up a second, parallel payments table that could drift out of
-- sync with it.
alter table public.registrations
  add column if not exists stripe_fee_cents integer,
  add column if not exists platform_fee_cents integer,
  add column if not exists net_payout_cents integer;

-- registrations had row level security turned on (migration 0002) but no
-- policy was ever actually written for it - meaning it's been unreadable
-- by anyone except the service-role key this whole time. That's why the
-- "Payment {status} — {amount}" entries never actually appeared in
-- /admin/history's timeline despite the query being there, and it's a
-- hard blocker for the new vendor "My Receipts" / admin "All Receipts"
-- views, which both read this table with a real user session.
drop policy if exists "vendor can read own registrations" on public.registrations;
create policy "vendor can read own registrations"
  on public.registrations for select
  using (claimed_by_vendor_id = auth.uid());

drop policy if exists "admin can read all registrations" on public.registrations;
create policy "admin can read all registrations"
  on public.registrations for select
  using (exists (select 1 from public.admins where id = auth.uid()));
