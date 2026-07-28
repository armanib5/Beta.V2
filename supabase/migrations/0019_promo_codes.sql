-- CityPinned v2.0 — promo codes: an admin-issued code a vendor can redeem
-- themselves for an instant free Top 10/Featured upgrade, instead of
-- needing to pay or wait on the Boost Request queue.
--
-- A vendor's own "update own profile" RLS policy can't be trusted to grant
-- this directly (that's exactly what protect_vendor_privileged_fields
-- exists to stop). Instead, redemption goes through a single
-- `security definer` function: it validates the code itself, in Postgres,
-- and is the only thing allowed to write the privileged vendor fields on
-- the vendor's behalf — the client never gets write access to them.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tier_id uuid not null references public.pricing_tiers (id),
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

drop policy if exists "admin can select promo codes" on public.promo_codes;
create policy "admin can select promo codes"
  on public.promo_codes for select
  using (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can insert promo codes" on public.promo_codes;
create policy "admin can insert promo codes"
  on public.promo_codes for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can update promo codes" on public.promo_codes;
create policy "admin can update promo codes"
  on public.promo_codes for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can delete promo codes" on public.promo_codes;
create policy "admin can delete promo codes"
  on public.promo_codes for delete
  using (exists (select 1 from public.admins where id = auth.uid()));

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo record;
  v_vendor_id uuid := auth.uid();
begin
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;

  if not exists (select 1 from public.vendors where id = v_vendor_id) then
    return jsonb_build_object('ok', false, 'error', 'No vendor profile found for this account.');
  end if;

  select * into v_promo from public.promo_codes
    where code = p_code
      and is_active = true
      and (expires_at is null or expires_at > now())
      and (max_uses is null or uses_count < max_uses)
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code is invalid, expired, or already used up.');
  end if;

  update public.vendors
    set is_top10 = true,
        category_tier = 'top_10',
        is_featured = true,
        tier_id = v_promo.tier_id,
        boost_requested_at = null
    where id = v_vendor_id;

  update public.promo_codes set uses_count = uses_count + 1 where id = v_promo.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;
