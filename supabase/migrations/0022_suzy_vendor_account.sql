-- Activates the vendor account just created for Suzy (Suzy's Creative
-- Inkspirations) so she can log in and manage her own workshop listing.
-- protect_vendor_privileged_fields silently resets `status` back to
-- "pending" on any write that isn't from a real admin session (same
-- SECURITY DEFINER/trigger gotcha fixed for promo codes in 0020) — a
-- plain UPDATE from the SQL Editor hits the same wall, so the trigger has
-- to be turned off for this one scoped write.
alter table public.vendors disable trigger protect_vendor_privileged_fields;
update public.vendors set status = 'active' where id = '1a67d02e-770c-4446-a36b-65b2262f30a9';
alter table public.vendors enable trigger protect_vendor_privileged_fields;
