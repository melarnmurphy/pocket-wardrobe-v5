-- 036_account_billing_data_dialogs.sql
-- Adds the hook point for the payment-failed/subscription-lapsed dialog
-- (billing_status), and the record behind the export started/ready toast
-- (data_export_requests). Neither is written to by a real payment or
-- export pipeline yet: see HANDOFF.md-equivalent notes in the account
-- dialogs report for the follow-on work this leaves open.

alter table public.user_entitlements
  add column if not exists billing_status text
    check (billing_status in ('active', 'payment_failed', 'lapsed'));

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'ready')),
  requested_at timestamptz not null default now(),
  ready_at timestamptz
);

create index if not exists data_export_requests_user_id_idx
  on public.data_export_requests (user_id);

alter table public.data_export_requests enable row level security;

create policy "data_export_requests_select_own"
  on public.data_export_requests for select
  using (user_id = auth.uid());

create policy "data_export_requests_insert_own"
  on public.data_export_requests for insert
  with check (user_id = auth.uid());
