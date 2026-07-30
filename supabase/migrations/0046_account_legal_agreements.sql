-- Audit trail for the event non-host / assumption-of-risk disclaimer
-- (distinct from the sales-final checkout acknowledgment already logged
-- to activity_log) - kept as its own table since it's a different legal
-- concern (physical/event liability vs. payment finality) that may need
-- independent versioning and review over time.
--
-- All writes come from the Cloudflare Worker using the service-role key
-- (signup calls /api/log-terms-agreement, checkout logs it inline in
-- handleCreateCheckoutSession) - never directly from the browser - so
-- there's no INSERT policy here at all, only SELECT. That sidesteps the
-- RLS/trigger traps this project has hit before with client-side writes
-- to admin-sensitive tables.
create table if not exists public.account_legal_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.vendors (id) on delete cascade,
  terms_version text not null,
  agreed_at timestamptz not null default now(),
  user_ip text
);

create index if not exists account_legal_agreements_user_id_idx on public.account_legal_agreements (user_id);

alter table public.account_legal_agreements enable row level security;

drop policy if exists "vendor can read own agreements" on public.account_legal_agreements;
create policy "vendor can read own agreements"
  on public.account_legal_agreements for select
  using (auth.uid() = user_id);

drop policy if exists "admin can read all agreements" on public.account_legal_agreements;
create policy "admin can read all agreements"
  on public.account_legal_agreements for select
  using (exists (select 1 from public.admins where id = auth.uid()));
