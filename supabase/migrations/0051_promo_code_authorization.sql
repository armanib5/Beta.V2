-- Restricts promo code redemption (WELCOME) to specific admin-authorized
-- vendors instead of any signed-in vendor who discovers the code string,
-- and closes the gaps found in the promo-code audit: unlimited same-
-- vendor reuse, no purchase record, no redemption log, and always
-- granting Top10+Featured regardless of what tier the code is actually
-- configured for. Does not touch Stripe Checkout, the webhook, or any
-- existing registrations row in any way.

-- Which vendors an admin has explicitly authorized to redeem a specific
-- promo code - the actual "approved founding vendors" allowlist. A code
-- existing and being active is no longer sufficient on its own; a vendor
-- also needs a row here for that specific code.
create table if not exists public.promo_code_grants (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (promo_code_id, vendor_id)
);

alter table public.promo_code_grants enable row level security;

drop policy if exists "admin can manage promo code grants" on public.promo_code_grants;
create policy "admin can manage promo code grants"
  on public.promo_code_grants for all
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

-- A vendor needs to see their OWN grants so the dashboard can show/hide
-- the redeem box sensibly - read-only, and only their own rows.
drop policy if exists "vendor can read own promo code grants" on public.promo_code_grants;
create policy "vendor can read own promo code grants"
  on public.promo_code_grants for select
  using (vendor_id = auth.uid());

-- The redemption audit log the audit asked for - distinct from
-- `registrations` (the financial ledger every real Stripe purchase also
-- lands in): this is specifically "which vendor redeemed which code,
-- when, linked to which purchase record."
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tier_id uuid not null references public.pricing_tiers (id),
  registration_id uuid references public.registrations (id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, vendor_id)
);

alter table public.promo_redemptions enable row level security;

drop policy if exists "admin can read promo redemptions" on public.promo_redemptions;
create policy "admin can read promo redemptions"
  on public.promo_redemptions for select
  using (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "vendor can read own promo redemptions" on public.promo_redemptions;
create policy "vendor can read own promo redemptions"
  on public.promo_redemptions for select
  using (vendor_id = auth.uid());

-- No insert policy for either role - the only writer is
-- redeem_promo_code() below, via security definer, same trust boundary
-- the function already operates under.

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo record;
  v_vendor_id uuid := auth.uid();
  v_vendor record;
  v_tier record;
  v_registration_id uuid;
begin
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;

  select * into v_vendor from public.vendors where id = v_vendor_id;
  if not found then
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

  -- The actual fix: a code being active/unexpired is no longer enough -
  -- this vendor also needs an explicit admin-granted authorization row
  -- for THIS code. Closes "anyone who discovers/guesses the code string
  -- gets a free upgrade," the main finding from the promo code audit.
  if not exists (
    select 1 from public.promo_code_grants
    where promo_code_id = v_promo.id and vendor_id = v_vendor_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'This code is not available for your account.');
  end if;

  -- One redemption per vendor per code - the old version had no such
  -- check at all, so a single authorized vendor could call this
  -- repeatedly and inflate uses_count indefinitely.
  if exists (
    select 1 from public.promo_redemptions
    where promo_code_id = v_promo.id and vendor_id = v_vendor_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'You have already redeemed this code.');
  end if;

  select * into v_tier from public.pricing_tiers where id = v_promo.tier_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This code''s tier is no longer available.');
  end if;

  -- vendor-boost/top10-30min are slot-scheduled (need an explicit
  -- slot_start/slot_end a generic "type in a code" redemption has no way
  -- to specify, per the same branch worker/index.ts's webhook already
  -- uses) - not meaningful to grant via direct redemption.
  if v_tier.slug in ('vendor-boost', 'top10-30min') then
    return jsonb_build_object('ok', false, 'error', 'This code''s tier is not available for direct redemption.');
  end if;

  alter table public.vendors disable trigger protect_vendor_privileged_fields;

  -- Grants only what this tier is actually configured for - mirrors the
  -- exact branch worker/index.ts's Stripe webhook uses for the same
  -- non-slot tiers, instead of the old hardcoded is_top10/is_featured=true
  -- regardless of the promo's configured tier.
  update public.vendors
    set status = 'active',
        approved_at = coalesce(approved_at, now()),
        tier_id = v_promo.tier_id,
        is_founding_vendor = is_founding_vendor or v_tier.is_founding,
        is_top10 = is_top10 or v_tier.is_top10,
        is_featured = is_featured or v_tier.is_top10,
        category_tier = case when v_tier.is_top10 then 'top_10' else category_tier end
    where id = v_vendor_id;

  alter table public.vendors enable trigger protect_vendor_privileged_fields;

  -- The purchase record the audit asked for - same ledger every real
  -- Stripe purchase lands in (registrations), so a promo redemption shows
  -- up in /admin/receipts and the vendor's own "My Receipts" exactly like
  -- any other order, just at $0 and with no Stripe session attached.
  insert into public.registrations (
    tier_id, claimed_by_vendor_id, business_name, contact_email,
    amount_cents, currency, status, awarded_top10, paid_at
  ) values (
    v_promo.tier_id, v_vendor_id, v_vendor.business_name, v_vendor.contact_email,
    0, 'usd', 'paid', v_tier.is_top10, now()
  ) returning id into v_registration_id;

  insert into public.promo_redemptions (promo_code_id, vendor_id, tier_id, registration_id)
  values (v_promo.id, v_vendor_id, v_promo.tier_id, v_registration_id);

  update public.promo_codes set uses_count = uses_count + 1 where id = v_promo.id;

  return jsonb_build_object('ok', true);
exception when others then
  alter table public.vendors enable trigger protect_vendor_privileged_fields;
  raise;
end;
$$;
