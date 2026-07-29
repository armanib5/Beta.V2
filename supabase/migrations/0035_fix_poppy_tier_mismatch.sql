-- Poppy's is_top10 was true but category_tier had drifted to "standard"
-- (should be "top_10" to match) — a plain UPDATE couldn't fix this
-- because protect_vendor_privileged_fields guards category_tier too,
-- same disable/enable dance as every other privileged-field fix this
-- session.
alter table public.vendors disable trigger protect_vendor_privileged_fields;
update public.vendors set category_tier = 'top_10' where id = 'bdfb2361-a8a3-4358-8f4b-55fdd165502b';

-- Resets the existing test account (used to demo the approval badge
-- earlier) back to "pending" so the badge has something to show again -
-- its status had moved to "suspended" since then.
update public.vendors set status = 'pending' where slug = 'test-approval-badge';
alter table public.vendors enable trigger protect_vendor_privileged_fields;
