-- Admin Photo Admin page needs to add/remove photos across ANY vendor or
-- flyer, not just their own — previously only a vendor could write to
-- their own storage folder (vendor can upload/update/delete own files,
-- 0002) and only a vendor could manage their own vendor_photos rows
-- (0002). Admin had no override for either.

create policy "admin can insert any vendor photo file"
  on storage.objects for insert
  with check (bucket_id = 'vendor-photos' and exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update any vendor photo file"
  on storage.objects for update
  using (bucket_id = 'vendor-photos' and exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete any vendor photo file"
  on storage.objects for delete
  using (bucket_id = 'vendor-photos' and exists (select 1 from public.admins where id = auth.uid()));

create policy "admin manages any vendor_photos row"
  on public.vendor_photos for all
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));
