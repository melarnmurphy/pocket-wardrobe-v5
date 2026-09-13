-- Entitlements are billing authority, not user-editable profile data.
-- Keep the client read-only; service-role billing/webhook code can still
-- upsert these rows because service_role bypasses RLS.

drop policy if exists user_entitlements_insert_own on public.user_entitlements;
drop policy if exists user_entitlements_update_own on public.user_entitlements;
drop policy if exists user_entitlements_delete_own on public.user_entitlements;

comment on table public.user_entitlements is
  'Billing-derived feature access. Readable by the owning user; writable only by trusted server-side billing code.';
