-- HOSTING HUB — a third account type alongside Vendor Hub (pop-up event
-- vendors) and Menu Hub (a restaurant/bar's own storefront menu): a venue
-- that HOSTS someone else's event (e.g. a restaurant hosting a craft
-- workshop). The hosting venue keeps its own independent account/flyer/
-- menu hub, and is ALSO linked on the guest event's flyer so tapping
-- through from that event goes to the venue's real account instead of a
-- generic Vendor Hub.
alter table public.vendors
  add column if not exists hub_type text not null default 'vendor'
    check (hub_type in ('vendor', 'menu', 'hosting'));

alter table public.lov_entries
  add column if not exists hosting_vendor_id uuid references public.vendors (id) on delete set null;

-- Focal point for the flyer-card crop (0-100 = left/top .. right/bottom,
-- default 50/50 = centered) — lets a vendor pick which part of their
-- logo photo shows in the wide flyer-card crop instead of always
-- center-cropping.
alter table public.vendors
  add column if not exists logo_focal_x numeric not null default 50,
  add column if not exists logo_focal_y numeric not null default 50;

-- Activates the vendor account just created for Tony & Alba's Pizza and
-- Pasta (the real restaurant hosting Suzy's craft workshop), sets it up
-- as a Menu Hub account, and links Suzy's event to it as the hosting
-- venue. Status has to go through the same disable/enable trigger dance
-- as Suzy's own account (0022) — hub_type/hosting_vendor_id aren't
-- privileged fields so those two just work as plain updates.
alter table public.vendors disable trigger protect_vendor_privileged_fields;
update public.vendors set status = 'active' where id = 'ffb3bbc8-d052-4bbd-be07-9dbc7bdc0c54';
alter table public.vendors enable trigger protect_vendor_privileged_fields;

update public.vendors set hub_type = 'menu' where id = 'ffb3bbc8-d052-4bbd-be07-9dbc7bdc0c54';

update public.lov_entries
set hosting_vendor_id = 'ffb3bbc8-d052-4bbd-be07-9dbc7bdc0c54'
where id = 'f5cdadf8-f3e2-4943-b162-0518366e8990';
