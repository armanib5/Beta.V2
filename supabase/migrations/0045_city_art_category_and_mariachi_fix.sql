-- Already applied directly via service-role REST - recorded here so the
-- migrations directory stays the source of truth for live data.
--
-- 1) 0044's Mariachi insert landed as 'pending' instead of 'archived' -
--    force_pending_lov_submission (0017) fires on every INSERT with no
--    admin session and overrides whatever status was sent, same trap
--    0031/0032 worked around with an explicit disable/enable trigger
--    pair that 0044 forgot. Fixed with a plain UPDATE (that trigger only
--    fires on INSERT, so this sticks).
update public.lov_entries
set status = 'archived'
where name = 'Silicon Valley Mariachi Festival' and status = 'pending';

-- 2) V2 never had a "City Art" category - only "Art Walk" - even though
--    the old V1 site treats them as two distinct categories. Added it and
--    moved Sonic Runway (a public art installation, not a walking event)
--    onto it.
insert into public.categories (name, slug, icon, sort_order)
values ('City Art', 'city-art', '🎨', 0)
on conflict (slug) do nothing;

update public.lov_entries
set category_id = (select id from public.categories where slug = 'city-art')
where name = 'Sonic Runway';
