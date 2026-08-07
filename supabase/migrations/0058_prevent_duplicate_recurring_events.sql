-- "DTSJ Art Walk" existed as two separate rows: a recurring template
-- (recurrence set, event_date null) and a one-off dated occurrence
-- (event_date set, recurrence null) for the same name. The existing
-- dedupe index (migration 0005) maps a null event_date to a sentinel
-- date so recurring rows dedupe against each other and dated rows
-- dedupe per-date - it was never meant to (and doesn't) stop a
-- recurring row and a dated row for the same name coexisting, since
-- their event_date_key values genuinely differ. expandRecurringEventForMonth()
-- (src/lib/recurrence.ts) already does the real work of turning one
-- recurring row into calendar occurrences client-side, with no DB
-- writes - a second, separately-created dated row is a redundant
-- duplicate of what that expansion already produces, not a second
-- real event.

create or replace function public.prevent_duplicate_recurring_event()
returns trigger as $$
begin
  if new.type = 'event' and new.recurrence is null and new.event_date is not null then
    if exists (
      select 1 from public.lov_entries
      where type = 'event'
        and name = new.name
        and recurrence is not null
        and status <> 'archived'
        and id is distinct from new.id
    ) then
      raise exception 'A recurring event named "%" already exists - edit that one instead of creating a dated duplicate.', new.name;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists prevent_duplicate_recurring_event on public.lov_entries;
create trigger prevent_duplicate_recurring_event
  before insert or update on public.lov_entries
  for each row execute function public.prevent_duplicate_recurring_event();
