-- P0 stabilization fix (Monday stabilization pass): auto_suspend_on_report()
-- (migration 0049) suspended a vendor/event the moment the very FIRST
-- anonymous, unauthenticated report against it landed, with only a
-- 10-minute per-target cooldown (migration 0052) as the sole abuse guard.
-- A single bad-faith click could take a real, legitimate vendor's live
-- listing offline instantly, with no warning to the vendor and no chance
-- for a human to weigh in first.
--
-- This raises the bar to "at least 3 reports against the same target
-- within a rolling 24-hour window" before the automatic suspend fires.
-- Genuine abuse or a real problem still tends to draw more than one
-- report in short order, so the system still self-heals automatically for
-- that case - but one heckler's single click can no longer take a
-- legitimate vendor down on its own. The 10-minute cooldown from 0052 is
-- untouched and still blocks the same target being re-reported faster
-- than once per 10 minutes, so 3 genuinely independent reports still need
-- to be spread out a little, same as before.
--
-- Reporting itself, report logging, and admin visibility/manual-suspend
-- and reactivate ability on /admin/reports are all completely unchanged -
-- only the automatic trigger's firing condition changes.
--
-- The threshold (3 reports) and window (24 hours) are a reasonable
-- starting default chosen for this fix, not a number handed down by the
-- product owner - confirm/adjust if a different threshold is wanted.
create or replace function public.auto_suspend_on_report()
returns trigger as $$
declare
  report_count int;
begin
  begin
    if new.target_id is null then
      return new;
    end if;

    select count(*) into report_count
    from public.reports
    where target_type = new.target_type
      and target_id = new.target_id
      and created_at > now() - interval '24 hours';
    -- This is an AFTER INSERT trigger, so report_count already includes
    -- the row that was just inserted - report_count >= 3 means "this is
    -- the 3rd (or later) report in the window", not "3 more after this one".
    if report_count < 3 then
      return new;
    end if;

    if new.target_type = 'vendor' then
      perform set_config('citypinned.bypass_privileged_guard', 'true', true);
      update public.vendors set status = 'suspended' where id = new.target_id::uuid and status <> 'suspended';
      perform set_config('citypinned.bypass_privileged_guard', 'false', true);
    elsif new.target_type = 'event' then
      update public.lov_entries set status = 'archived' where id = new.target_id::uuid and status <> 'archived';
    end if;
  exception when others then
    -- A malformed/non-UUID target_id (e.g. a legacy static map pin with
    -- no real database row) should never block the report itself from
    -- being logged - just skip the suspend side effect.
    null;
  end;
  return new;
end;
$$ language plpgsql security definer;
