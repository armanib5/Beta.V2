-- Lets a vendor manage the photo/description on THEIR OWN linked
-- lov_entries row (vendor_id = them) — e.g. Suzy uploading her own
-- workshop flyer photo. Previously only an admin session could write to
-- lov_entries at all, so a vendor with a linked guest listing had no
-- self-service path even after logging in.
create policy "vendor can update own linked listing"
  on public.lov_entries for update
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Same self-elevation guard pattern as protect_vendor_privileged_fields:
-- a vendor editing their own listing can change the photo/description/
-- links, but not silently change what/when/where the event is or its
-- promoted status — those stay admin- or public-submission-review-only.
create or replace function public.protect_lov_entry_privileged_fields()
returns trigger as $$
begin
  if exists (select 1 from public.admins where id = auth.uid()) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.vendor_id is not null and old.vendor_id = auth.uid() then
    new.name := old.name;
    new.event_date := old.event_date;
    new.end_date := old.end_date;
    new.recurrence := old.recurrence;
    new.location := old.location;
    new.lat := old.lat;
    new.lng := old.lng;
    new.category_id := old.category_id;
    new.status := old.status;
    new.category_tier := old.category_tier;
    new.booth_tier := old.booth_tier;
    new.is_featured := old.is_featured;
    new.section_zone := old.section_zone;
    new.publish_at := old.publish_at;
    new.vendor_id := old.vendor_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_lov_entry_privileged_fields on public.lov_entries;
create trigger protect_lov_entry_privileged_fields
  before update on public.lov_entries
  for each row execute function public.protect_lov_entry_privileged_fields();
