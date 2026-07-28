-- CityPinned v2.0 — Pins Manager (Back Office): a clean, unified `pins`
-- table in this project, replacing the old /pins/ + /admin/ pipeline that
-- pointed at a completely different, abandoned Supabase project and used
-- stale categories (including "Art Walk", removed from the app earlier).
-- That old pipeline is left untouched and out of scope here — flagged
-- separately, not silently orphaned.

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('food', 'parking', 'restroom', 'safety', 'business', 'event')),
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'expired')),
  lat double precision not null,
  lng double precision not null,
  vendor_id uuid references public.vendors (id) on delete set null,
  event_id uuid references public.lov_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pins_status_idx on public.pins (status);
create index if not exists pins_category_idx on public.pins (category);

drop trigger if exists set_updated_at on public.pins;
create trigger set_updated_at before update on public.pins
  for each row execute function public.set_updated_at();

alter table public.pins enable row level security;

-- Public map/board only ever needs approved pins; everything else
-- (draft/pending/expired) is admin-only, same visibility model as
-- lov_entries.status.
create policy "approved pins are publicly readable"
  on public.pins for select
  using (status = 'approved');

create policy "admin can select any pin"
  on public.pins for select
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can insert pins"
  on public.pins for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can update pins"
  on public.pins for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can delete pins"
  on public.pins for delete
  using (exists (select 1 from public.admins where id = auth.uid()));

-- ---------------------------------------------------------------------------
-- CityPinned's own internal admin account (created so the site owner has a
-- login) is a row in `vendors` for auth purposes only — it isn't a real
-- shop/vendor/place, but every public "active vendors" query (Vendor
-- Directory, the Board's flyer grid, the Map's vendor pins) had no way to
-- tell it apart from a real business and would show it as one. This flag
-- lets those queries exclude it explicitly instead of by fragile name
-- matching.
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists is_internal boolean not null default false;

update public.vendors set is_internal = true where business_name = 'CityPinned Admin';

-- Seed check: link the "Seas the Day & Craft Away!" craft workshop
-- (already in lov_entries) to a real, approved pin at its real venue.
insert into public.pins (title, description, category, status, lat, lng, event_id)
select
  'Seas the Day & Craft Away! Beachy Papercrafting Workshop',
  'Hosted by Suzy Berlant (Suzy''s Creative Inkspirations) at Tony & Alba''s Pizza and Pasta.',
  'event', 'approved', lat, lng, id
from public.lov_entries
where id = 'f5cdadf8-f3e2-4943-b162-0518366e8990'
  and not exists (select 1 from public.pins where event_id = 'f5cdadf8-f3e2-4943-b162-0518366e8990');
