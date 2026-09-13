create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_webhook_events enable row level security;

create or replace function public.claim_billing_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  insert into public.billing_webhook_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do update
    set status = 'processing', error_message = null, received_at = now(), processed_at = null
    where public.billing_webhook_events.status = 'failed'
      or public.billing_webhook_events.received_at < now() - interval '15 minutes'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.finish_billing_webhook_event(
  p_event_id text,
  p_status text,
  p_error_message text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.billing_webhook_events
  set status = p_status,
      error_message = p_error_message,
      processed_at = now()
  where event_id = p_event_id;
$$;

revoke all on function public.claim_billing_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.finish_billing_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_event(text, text) to service_role;
grant execute on function public.finish_billing_webhook_event(text, text, text) to service_role;
