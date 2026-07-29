-- Real Pending / Approved / Rejected bookkeeping for vendor approvals.
-- Previously "Reject" silently reused the "suspended" status (meant for
-- pausing an already-approved vendor), so there was no real distinction
-- between "never approved" and "approved then paused," and no timestamp
-- at all for when a vendor was actually approved.

alter table public.vendors drop constraint if exists vendors_status_check;
alter table public.vendors add constraint vendors_status_check
  check (status in ('pending', 'active', 'suspended', 'rejected'));

alter table public.vendors
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

-- Full history of every status change, for the "timed out" / "reapproved"
-- bookkeeping filters — a single approved_at column can't tell "approved
-- once" from "rejected, then approved again," but the log can.
create table if not exists public.vendor_status_log (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists vendor_status_log_vendor_id_idx on public.vendor_status_log (vendor_id);

alter table public.vendor_status_log enable row level security;

create policy "admin can read vendor status log"
  on public.vendor_status_log for select
  using (exists (select 1 from public.admins where id = auth.uid()));

-- Named "zz_..." on purpose: Postgres fires same-timing triggers in
-- alphabetical order by trigger name, and this one must run AFTER
-- protect_vendor_privileged_fields so it logs the FINAL status (after a
-- non-admin's attempted self-elevation has already been reverted), not
-- the raw attempted value — otherwise a vendor's own profile-update call
-- (RLS allows updating their own row) could plant a bogus "approved" log
-- entry/timestamp even though protect_vendor_privileged_fields silently
-- reverted the actual status change.
create or replace function public.zz_log_vendor_status_change()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into public.vendor_status_log (vendor_id, old_status, new_status)
    values (new.id, old.status, new.status);
    if new.status = 'active' then
      new.approved_at := now();
    elsif new.status = 'rejected' then
      new.rejected_at := now();
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists log_vendor_status_change on public.vendors;
drop trigger if exists zz_log_vendor_status_change on public.vendors;
create trigger zz_log_vendor_status_change
  before update on public.vendors
  for each row execute function public.zz_log_vendor_status_change();
