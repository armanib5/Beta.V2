-- MENU HUB — restaurants/bars get their own "Bites & Sips" hub instead of
-- the generic pop-up Vendor Hub: happy hour/daily specials text plus a
-- real menu of items (photo + price), with up to 5 Top Picks per kind
-- (bite/sip) they can feature. Pop-up event vendors keep the existing
-- Vendor Hub + paid boost/top10 flow untouched — this is additive.

alter table public.vendors
  add column if not exists menu_hub_enabled boolean not null default true;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  kind text not null check (kind in ('bite', 'sip')),
  name text not null,
  description text,
  price_cents int,
  photo_url text,
  is_top_pick boolean not null default false,
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_vendor_id_idx on public.menu_items (vendor_id);

alter table public.menu_items enable row level security;

create policy "anyone can read active menu items"
  on public.menu_items for select
  using (status = 'active');

create policy "vendor can read own menu items"
  on public.menu_items for select
  using (vendor_id = auth.uid());

create policy "vendor can insert own menu items"
  on public.menu_items for insert
  with check (vendor_id = auth.uid());

create policy "vendor can update own menu items"
  on public.menu_items for update
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

create policy "vendor can delete own menu items"
  on public.menu_items for delete
  using (vendor_id = auth.uid());

create policy "admin can manage any menu item"
  on public.menu_items for all
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop trigger if exists set_updated_at on public.menu_items;
create trigger set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

-- Caps Top Picks at 5 per kind per vendor (5 bites + 5 sips), enforced in
-- the database since this is the only real write gate on a static export.
create or replace function public.enforce_menu_top_pick_cap()
returns trigger as $$
begin
  if new.is_top_pick and (tg_op = 'INSERT' or not old.is_top_pick) then
    if (
      select count(*) from public.menu_items
      where vendor_id = new.vendor_id and kind = new.kind and is_top_pick = true
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 5 then
      raise exception 'Only 5 Top Pick % items are allowed per vendor.', new.kind;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_menu_top_pick_cap on public.menu_items;
create trigger enforce_menu_top_pick_cap
  before insert or update on public.menu_items
  for each row execute function public.enforce_menu_top_pick_cap();
