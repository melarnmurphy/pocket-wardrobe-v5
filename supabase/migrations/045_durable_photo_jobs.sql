-- Claim one queued photo-analysis job atomically so concurrent workers do not
-- process the same image. The service-role worker is the only caller.
alter table public.processing_jobs
  drop constraint if exists processing_jobs_job_type_check;

alter table public.processing_jobs
  add constraint processing_jobs_job_type_check check (
    job_type in (
      'image_analysis',
      'receipt_parsing',
      'outfit_decomposition',
      'colour_extraction',
      'embedding_generation',
      'garment_classification',
      'photo_batch',
      'photo_batch_item'
    )
  );

alter table public.processing_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz;

create or replace function public.claim_photo_batch_item()
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.processing_jobs
  set status = 'running',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  where id = (
    select id
    from public.processing_jobs
    where job_type = 'photo_batch_item'
      and status = 'queued'
      and available_at <= now()
      and attempt_count < 3
    order by created_at
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

create or replace function public.finish_photo_batch_item(
  p_item_id uuid,
  p_draft_ids uuid[] default '{}',
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  select target_id into v_batch_id
  from public.processing_jobs
  where id = p_item_id and job_type = 'photo_batch_item';

  if v_batch_id is null then return; end if;

  update public.processing_jobs
  set status = case when p_error_message is null then 'succeeded' else 'failed' end,
      result_payload_json = jsonb_build_object('draft_ids', to_jsonb(p_draft_ids)),
      error_message = p_error_message,
      locked_at = null,
      updated_at = now()
  where id = p_item_id and status = 'running';

  update public.processing_jobs
  set done_count = done_count + 1,
      draft_ids = draft_ids || p_draft_ids,
      error_message = case
        when p_error_message is null then error_message
        when error_message is null then p_error_message
        else error_message || ' ' || p_error_message
      end,
      status = case
        when done_count + 1 >= total_count and error_message is null and p_error_message is null then 'succeeded'
        when done_count + 1 >= total_count then 'failed'
        else 'running'
      end,
      updated_at = now()
  where id = v_batch_id and job_type = 'photo_batch';
end;
$$;

create or replace function public.retry_photo_batch_item(
  p_item_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
begin
  select attempt_count into v_attempt_count
  from public.processing_jobs
  where id = p_item_id and job_type = 'photo_batch_item' and status = 'running';

  if v_attempt_count is null then return false; end if;

  if v_attempt_count < 3 then
    update public.processing_jobs
    set status = 'queued',
        error_message = p_error_message,
        available_at = now() + make_interval(secs => greatest(v_attempt_count * 10, 10)),
        locked_at = null,
        updated_at = now()
    where id = p_item_id;
    return true;
  end if;

  perform public.finish_photo_batch_item(p_item_id, '{}', p_error_message);
  return false;
end;
$$;

revoke all on function public.claim_photo_batch_item() from public, anon, authenticated;
grant execute on function public.claim_photo_batch_item() to service_role;
revoke all on function public.finish_photo_batch_item(uuid, uuid[], text) from public, anon, authenticated;
revoke all on function public.retry_photo_batch_item(uuid, text) from public, anon, authenticated;
grant execute on function public.finish_photo_batch_item(uuid, uuid[], text) to service_role;
grant execute on function public.retry_photo_batch_item(uuid, text) to service_role;
