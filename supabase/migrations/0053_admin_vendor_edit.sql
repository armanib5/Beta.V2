-- V2 cleanup pass: admin currently has zero way to edit a vendor's
-- profile on their behalf (name, description, category, social links,
-- logo/photos) - every field except status/founding/top10/boost is
-- vendor-only. Admin can already write any column on `vendors` directly
-- (the existing "admin can update any vendor" policy from migration 0007
-- bypasses protect_vendor_privileged_fields entirely for admins), so the
-- only two real gaps are vendor_categories (vendor-only today) and the
-- vendor-photos storage bucket (vendor-only today, keyed on
-- auth.uid() = folder name).

drop policy if exists "admin manages vendor category links" on public.vendor_categories;
create policy "admin manages vendor category links"
  on public.vendor_categories for all
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can upload vendor photos" on storage.objects;
create policy "admin can upload vendor photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-photos'
    and exists (select 1 from public.admins where id = auth.uid())
  );

drop policy if exists "admin can update vendor photos" on storage.objects;
create policy "admin can update vendor photos"
  on storage.objects for update
  using (
    bucket_id = 'vendor-photos'
    and exists (select 1 from public.admins where id = auth.uid())
  );

drop policy if exists "admin can delete vendor photos" on storage.objects;
create policy "admin can delete vendor photos"
  on storage.objects for delete
  using (
    bucket_id = 'vendor-photos'
    and exists (select 1 from public.admins where id = auth.uid())
  );
