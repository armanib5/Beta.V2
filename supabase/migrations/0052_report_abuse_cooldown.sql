-- Launch-hardening audit finding: the public "Report" form
-- (public/board/js/reports.js) posts straight to this table with zero
-- friction - no login, no CAPTCHA, no rate limit - and
-- auto_suspend_on_report() (migration 0049) suspends the target on the
-- very FIRST report, no threshold. Nothing stopped a competitor/troll
-- from repeatedly re-reporting the same vendor every time an admin
-- reactivated it, indefinitely. This closes that specific, most-damaging
-- pattern: no more than one suspend-triggering report per target within
-- a 10-minute window. Anonymous submitters still have no identity to key
-- a real per-person rate limit off of - a proper bot-check (e.g.
-- Cloudflare Turnstile) is the correct next layer, tracked separately,
-- not attempted here.
create or replace function public.enforce_report_cooldown()
returns trigger as $$
begin
  if new.target_id is not null and exists (
    select 1 from public.reports
    where target_id = new.target_id
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'A report for this listing was already submitted recently. Please try again in a few minutes.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_report_cooldown on public.reports;
create trigger enforce_report_cooldown
  before insert on public.reports
  for each row execute function public.enforce_report_cooldown();
