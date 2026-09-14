-- Move high-frequency queue workers off Vercel Cron.
--
-- The app's Vercel project is currently on Hobby, where cron jobs may only run
-- once per day. Supabase Cron is a better fit for these database-backed queue
-- workers because pg_cron can invoke an authenticated HTTP endpoint frequently.
-- The URL and secret are provisioned separately; neither is stored in Git.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.cron_http_config (
  id boolean primary key default true check (id),
  base_url text not null check (base_url ~ '^https://'),
  cron_secret text not null check (length(cron_secret) >= 16),
  updated_at timestamptz not null default now()
);

comment on table private.cron_http_config is
  'Runtime-only configuration for Supabase Cron HTTP workers. Never expose through the API.';

create or replace function private.invoke_cron_http(p_path text)
returns bigint
language plpgsql
security definer
set search_path = private, net, public
as $fn$
declare
  v_base_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select base_url, cron_secret
  into v_base_url, v_cron_secret
  from private.cron_http_config
  where id = true;

  if v_base_url is null or v_cron_secret is null then
    raise warning 'Supabase Cron HTTP config is not provisioned';
    return null;
  end if;

  select net.http_post(
    url := v_base_url || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  into v_request_id;

  return v_request_id;
end;
$fn$;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.cron_http_config from public, anon, authenticated;
revoke all on function private.invoke_cron_http(text) from public, anon, authenticated;

do $job$
begin
  if exists (select 1 from cron.job where jobname = 'pocketwardrobe-photo-processing') then
    perform cron.unschedule('pocketwardrobe-photo-processing');
  end if;
  if exists (select 1 from cron.job where jobname = 'pocketwardrobe-trend-extraction') then
    perform cron.unschedule('pocketwardrobe-trend-extraction');
  end if;

  perform cron.schedule(
    'pocketwardrobe-photo-processing',
    '*/5 * * * *',
    $sql$select private.invoke_cron_http('/api/cron/photo-processing');$sql$
  );

  perform cron.schedule(
    'pocketwardrobe-trend-extraction',
    '*/15 * * * *',
    $sql$select private.invoke_cron_http('/api/trends/extract');$sql$
  );
end;
$job$;

commit;
