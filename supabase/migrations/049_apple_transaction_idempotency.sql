create table if not exists public.apple_transaction_events (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_transaction_id text,
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  expires_at timestamptz,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.apple_transaction_events enable row level security;

create or replace function public.claim_apple_transaction(
  p_transaction_id text,
  p_user_id uuid,
  p_original_transaction_id text,
  p_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
  v_existing_user uuid;
begin
  select user_id into v_existing_user
  from public.apple_transaction_events
  where transaction_id = p_transaction_id;

  if v_existing_user is not null and v_existing_user <> p_user_id then
    raise exception 'Apple transaction is already linked to another account';
  end if;

  insert into public.apple_transaction_events (
    transaction_id, user_id, original_transaction_id, expires_at
  )
  values (
    p_transaction_id, p_user_id, p_original_transaction_id, p_expires_at
  )
  on conflict (transaction_id) do update
    set status = 'processing', error_message = null,
        received_at = now(), processed_at = null,
        expires_at = excluded.expires_at
    where public.apple_transaction_events.status = 'failed'
      or public.apple_transaction_events.received_at < now() - interval '15 minutes'
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.finish_apple_transaction(
  p_transaction_id text,
  p_status text,
  p_error_message text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.apple_transaction_events
  set status = p_status,
      error_message = p_error_message,
      processed_at = now()
  where transaction_id = p_transaction_id;
$$;

revoke all on function public.claim_apple_transaction(text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_apple_transaction(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_apple_transaction(text, uuid, text, timestamptz) to service_role;
grant execute on function public.finish_apple_transaction(text, text, text) to service_role;
