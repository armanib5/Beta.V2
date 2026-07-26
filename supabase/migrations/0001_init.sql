-- CityPinned v2.0 — Foundational schema
-- Covers: vendor accounts/profiles, category tags, Stripe monetization/pre-order tiers,
-- registrations (payments), and vendor photo storage.
--
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- CATEGORIES  (vendor category tags, e.g. "Home Baker", "Coffee", "Artisan")
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text, -- emoji or icon identifier
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PRICING TIERS  (Stripe pre-order / founding-vendor lock-in tiers, $50-$100)
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- e.g. "Founding Vendor", "Top 10 Category"
  slug text not null unique,
  description text,
  price_cents int not null check (price_cents > 0),
  currency text not null default 'usd',
  is_top10 boolean not null default false,     -- confers "Top 10 Category" badge
  is_founding boolean not null default true,   -- confers "Founding Vendor" badge
  max_slots int,                          -- null = unlimited; used for Top 10 scarcity
  slots_claimed int not null default 0,
  stripe_price_id text,                   -- optional pre-created Stripe Price
  stripe_payment_link text,               -- optional hosted Stripe Payment Link (for QR display)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- VENDORS  (permanent vendor account, 1:1 with an auth.users row)
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique,
  business_name text not null,
  owner_name text,
  contact_email text not null,
  phone text,
  instagram_handle text,
  website_url text,
  short_description text,
  logo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  is_founding_vendor boolean not null default false,
  is_top10 boolean not null default false,
  tier_id uuid references public.pricing_tiers (id),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_status_idx on public.vendors (status);
create index if not exists vendors_tier_idx on public.vendors (tier_id);

-- ---------------------------------------------------------------------------
-- VENDOR <-> CATEGORY join table (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_categories (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (vendor_id, category_id)
);

-- ---------------------------------------------------------------------------
-- REGISTRATIONS  (Stripe payment / pre-order records)
-- A registration can exist before a vendor has created their login: it is
-- matched to a vendor account by email at signup time (see claimed_by_vendor_id).
-- ---------------------------------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.pricing_tiers (id),
  claimed_by_vendor_id uuid references public.vendors (id) on delete set null,
  business_name text,
  contact_email text not null,
  contact_phone text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  awarded_top10 boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists registrations_email_idx on public.registrations (contact_email);
create index if not exists registrations_status_idx on public.registrations (status);

-- ---------------------------------------------------------------------------
-- VENDOR PHOTOS  (permanent photo library per vendor — stored in Supabase
-- Storage bucket "vendor-photos"; this table just tracks metadata/order)
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_photos (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  storage_path text not null,
  url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vendor_photos_vendor_idx on public.vendor_photos (vendor_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.vendors;
create trigger set_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.pricing_tiers;
create trigger set_updated_at before update on public.pricing_tiers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Atomic Top 10 slot claim — a single UPDATE takes Postgres's row lock, so
-- concurrent Stripe webhook deliveries for different registrations can't
-- both grant the last slot.
-- ---------------------------------------------------------------------------
create or replace function public.claim_top10_slot(p_tier_id uuid)
returns boolean as $$
declare
  granted boolean;
begin
  update public.pricing_tiers
  set slots_claimed = slots_claimed + 1
  where id = p_tier_id
    and (max_slots is null or slots_claimed < max_slots)
  returning true into granted;

  return coalesce(granted, false);
end;
$$ language plpgsql security definer;
