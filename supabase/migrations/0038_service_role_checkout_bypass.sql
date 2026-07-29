-- The vendor-privileged-fields guard only ever recognized a real signed-in
-- admin session (auth.uid() found in public.admins) - every service-role
-- REST call (curl, SQL Editor, and now the Stripe webhook Worker) has a
-- NULL auth.uid() and got silently reverted, which is why every prior fix
-- this project needed an explicit disable/enable trigger dance around it.
-- auth.role() DOES distinguish the service-role key (it reads the JWT's
-- own "role" claim, which is 'service_role' for that key specifically,
-- independent of which user - or no user - the call is acting as), so the
-- checkout webhook can now set status/tier flags directly and permanently,
-- with no more manual trigger toggling needed for future service-role work.
create or replace function public.protect_vendor_privileged_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.admins where id = auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_founding_vendor := false;
    new.is_top10 := false;
    new.tier_id := null;
    new.category_tier := 'standard';
    new.is_featured := false;
  elsif tg_op = 'UPDATE' then
    new.status := old.status;
    new.is_founding_vendor := old.is_founding_vendor;
    new.is_top10 := old.is_top10;
    new.tier_id := old.tier_id;
    new.category_tier := old.category_tier;
    new.is_featured := old.is_featured;
  end if;

  return new;
end;
$$ language plpgsql security definer;
