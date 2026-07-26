-- CityPinned v2.0 — Row Level Security + Storage bucket for vendor photos/logos
--
-- Model: vendors read/write only their own row; public can read active vendor
-- profiles + categories + active pricing tiers; all writes to registrations
-- and payment-derived fields happen via the service-role key from server
-- routes (Stripe checkout/webhook), never directly from the browser.

alter table public.categories enable row level security;
alter table public.pricing_tiers enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_categories enable row level security;
alter table public.registrations enable row level security;
alter table public.vendor_photos enable row level security;

-- CATEGORIES: public read
create policy "categories are publicly readable"
  on public.categories for select
  using (true);

-- PRICING TIERS: public read of active tiers
create policy "active pricing tiers are publicly readable"
  on public.pricing_tiers for select
  using (is_active = true);

-- VENDORS: public read of active profiles; vendor can read/update own row
create policy "active vendor profiles are publicly readable"
  on public.vendors for select
  using (status = 'active');

create policy "vendor can read own profile"
  on public.vendors for select
  using (auth.uid() = id);

create policy "vendor can update own profile"
  on public.vendors for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Vendor row creation happens via a server route using the service-role key
-- (it must be linked to a paid registration), so no public insert policy.

-- VENDOR_CATEGORIES: public read; vendor manages their own tag links
create policy "vendor category links are publicly readable"
  on public.vendor_categories for select
  using (true);

create policy "vendor manages own category links"
  on public.vendor_categories for all
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- REGISTRATIONS: no public access at all — only service role (server) reads/writes.
-- (No policies = only service-role key can bypass RLS; anon/authenticated get nothing.)

-- VENDOR_PHOTOS: public read; vendor manages own photos
create policy "vendor photos are publicly readable"
  on public.vendor_photos for select
  using (true);

create policy "vendor manages own photos"
  on public.vendor_photos for all
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- ---------------------------------------------------------------------------
-- STORAGE: public bucket for logos + vendor photo uploads, permanent (no
-- transfer/expiry) — vendors upload directly, and files persist as long as
-- the vendor account does.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-photos', 'vendor-photos', true)
on conflict (id) do nothing;

create policy "vendor photos bucket is publicly readable"
  on storage.objects for select
  using (bucket_id = 'vendor-photos');

create policy "vendor can upload into own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vendor can update own files"
  on storage.objects for update
  using (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vendor can delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
