-- INTERNAL ADMIN NOTES / CRM MEMORY / ACTIVITY TIMELINE
-- Pure admin-side additions - no public RLS policy anywhere in this file,
-- no change to any customer-facing table's write path, no touch to
-- Stripe/checkout/signup. "Host" and "account" both collapse to the same
-- entity_type='vendor' (a Host Hub is just a vendor row with
-- hub_type='hosting'/'show' - there's no separate host table), matching
-- the existing activity_log/reports entity_type convention.

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

-- Edits preserve history: before an update touches `body`, the OLD body
-- gets archived here rather than just overwritten - "edit with history
-- preserved" means every prior version stays inspectable, not that the
-- note itself is immutable.
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

create policy "admin can read notes"
  on public.admin_notes for select
  using (exists (select 1 from public.admins where id = auth.uid()));
create policy "admin can write notes"
  on public.admin_notes for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));
create policy "admin can update notes"
  on public.admin_notes for update
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "admin can read note revisions"
  on public.admin_note_revisions for select
  using (exists (select 1 from public.admins where id = auth.uid()));
create policy "admin can write note revisions"
  on public.admin_note_revisions for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

-- FOLLOW-UP & RELATIONSHIP TRACKING - vendor-only (an event doesn't have
-- a "relationship"), simple columns rather than a side table since it's
-- 1:1 with the vendor row and always read/written alongside it.
alter table public.vendors
  add column if not exists relationship_status text
    check (relationship_status in ('contacted', 'interested', 'onboarding', 'active_vendor', 'inactive', 'needs_followup')),
  add column if not exists last_contact_date date,
  add column if not exists next_followup_date date;

-- ACTIVITY TIMELINE gap fill: every admin-initiated change already logs
-- to activity_log via explicit logActivity() calls, but a vendor editing
-- their OWN profile from their own dashboard never did (nothing to call
-- it from, and activity_log's insert policy is admin-only anyway). This
-- closes that gap at the database level instead of touching the
-- dashboard's save path - auth.uid() = new.id only matches a vendor
-- updating their own row (an admin's auth.uid() never equals another
-- vendor's id; the webhook's service-role calls have auth.uid() null),
-- so this can never mislabel an admin or webhook write as a self-edit.
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
