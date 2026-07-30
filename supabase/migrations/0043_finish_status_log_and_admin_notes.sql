-- Re-running the parts of 0025 and all of 0041 that never actually landed
-- on the live database (confirmed directly: vendors.approved_at,
-- vendor_status_log, admin_notes, admin_note_revisions all 404 on a real
-- REST query, even though 0042 already confirmed the vendors_status_check
-- constraint itself HAD been fixed). This is why /admin/history rendered
-- blank after reload - the tables its Notes/CRM/Timeline sections query
-- never existed. Everything below is copied verbatim from 0025/0041
-- (both fully idempotent - "if not exists" / "or replace" throughout),
-- minus the constraint change 0042 already applied.

-- ===== remainder of 0025_vendor_approval_log.sql =====
alter table public.vendors
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

create table if not exists public.vendor_status_log (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists vendor_status_log_vendor_id_idx on public.vendor_status_log (vendor_id);

alter table public.vendor_status_log enable row level security;

drop policy if exists "admin can read vendor status log" on public.vendor_status_log;
create policy "admin can read vendor status log"
  on public.vendor_status_log for select
  using (exists (select 1 from public.admins where id = auth.uid()));

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

-- ===== all of 0041_admin_notes_crm_timeline.sql =====
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('vendor', 'event')),
  entity_id uuid not null,
  note_type text not null default 'context'
    check (note_type in ('meeting', 'followup', 'partnership', 'conversation', 'communication', 'context')),
  body text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_email text
);

create index if not exists admin_notes_entity_idx on public.admin_notes (entity_type, entity_id);

create table if not exists public.admin_note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.admin_notes (id) on delete cascade,
  previous_body text not null,
  edited_by_email text not null,
  edited_at timestamptz not null default now()
);

create index if not exists admin_note_revisions_note_idx on public.admin_note_revisions (note_id);

alter table public.admin_notes enable row level security;
alter table public.admin_note_revisions enable row level security;

drop policy if exists "admin can read notes" on public.admin_notes;
create policy "admin can read notes"
  on public.admin_notes for select
  using (exists (select 1 from public.admins where id = auth.uid()));
drop policy if exists "admin can write notes" on public.admin_notes;
create policy "admin can write notes"
  on public.admin_notes for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));
drop policy if exists "admin can update notes" on public.admin_notes;
create policy "admin can update notes"
  on public.admin_notes for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admin can read note revisions" on public.admin_note_revisions;
create policy "admin can read note revisions"
  on public.admin_note_revisions for select
  using (exists (select 1 from public.admins where id = auth.uid()));
drop policy if exists "admin can write note revisions" on public.admin_note_revisions;
create policy "admin can write note revisions"
  on public.admin_note_revisions for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

alter table public.vendors
  add column if not exists relationship_status text
    check (relationship_status in ('contacted', 'interested', 'onboarding', 'active_vendor', 'inactive', 'needs_followup')),
  add column if not exists last_contact_date date,
  add column if not exists next_followup_date date;

create or replace function public.log_vendor_self_edit()
returns trigger as $$
begin
  if auth.uid() = new.id then
    insert into public.activity_log (entity_type, entity_id, entity_name, action, detail)
    values ('vendor', new.id, new.business_name, 'Vendor edited own profile', null);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists log_vendor_self_edit on public.vendors;
create trigger log_vendor_self_edit
  after update on public.vendors
  for each row execute function public.log_vendor_self_edit();
