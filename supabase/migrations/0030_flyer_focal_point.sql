-- lov_entries (farmers markets, festivals, guest flyers) never got the
-- crop focal-point system vendors did (0028) - their flyer photos always
-- hard center-crop, which cuts off the wrong part of the photo on markets
-- whose real subject isn't dead-center. Same 0-100 focal point concept,
-- settable from the admin Flyers page.
alter table public.lov_entries
  add column if not exists flyer_focal_x numeric not null default 50,
  add column if not exists flyer_focal_y numeric not null default 50;
