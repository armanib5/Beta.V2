-- CityPinned v2.0 — real bug found during QA testing: redeem_promo_code
-- (migration 0019) is SECURITY DEFINER, which bypasses Row Level Security
-- — but NOT triggers. protect_vendor_privileged_fields still fired on the
-- function's own UPDATE, checked the real caller's identity (the vendor,
-- not an admin), and silently reset is_top10/category_tier/is_featured/
-- tier_id right back to their old values before the row was saved. The
-- function returned {"ok": true} and the promo code's uses_count did
-- increment, but the vendor was never actually upgraded.
--
-- Fix: this function IS the validated, narrow gate for this one grant (it
-- already checked the code is real, active, unexpired, and under its use
-- limit before reaching this point) — same trust level as an admin
-- pasting the disable-trigger/update/enable-trigger SQL this session has
-- used everywhere else. It now does exactly that, scoped to just its own
-- single controlled write, with the trigger guaranteed to be re-enabled
-- even if something above fails.
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

  alter table public.vendors disable trigger protect_vendor_privileged_fields;

  update public.vendors
    set is_top10 = true,
        category_tier = 'top_10',
        is_featured = true,
        tier_id = v_promo.tier_id,
        boost_requested_at = null
    where id = v_vendor_id;

  alter table public.vendors enable trigger protect_vendor_privileged_fields;

  update public.promo_codes set uses_count = uses_count + 1 where id = v_promo.id;

  return jsonb_build_object('ok', true);
exception when others then
  alter table public.vendors enable trigger protect_vendor_privileged_fields;
  raise;
end;
$$;
