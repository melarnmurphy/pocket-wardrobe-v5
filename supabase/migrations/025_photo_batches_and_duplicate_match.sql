-- Phase 3 (getting pieces in): batch add (14a/14b) needs a persisted place
-- to track progress across many photos so the user can close the app
-- mid-batch and find the work finished when they come back. processing_jobs
-- already has the right shape (per-user, status, result payload) and is
-- otherwise unused, so this extends it rather than adding a parallel table.
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
      'photo_batch'
    )
  );

alter table public.processing_jobs
  add column if not exists done_count integer not null default 0,
  add column if not exists total_count integer not null default 0,
  add column if not exists draft_ids uuid[] not null default '{}';

create index if not exists processing_jobs_user_job_type_idx
  on public.processing_jobs (user_id, job_type, status);

-- Duplicate compare (never a silent merge): a draft's crop embedding is
-- compared against the user's existing wardrobe before it is shown for
-- review, so the reviewer sees a side-by-side above 0.92 similarity instead
-- of two near-identical pieces silently coexisting. garments.embedding is
-- already vector(768) with an ivfflat index (migration 003); this mirrors
-- the match_trend_signals() pattern (migration 005) for garments, scoped to
-- one user's own wardrobe.
create or replace function match_garments_by_embedding(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float default 0.92,
  match_count int default 3
)
returns table (
  id uuid,
  title text,
  category text,
  similarity float
)
language sql stable
as $$
  select
    id, title, category,
    1 - (embedding <=> query_embedding) as similarity
  from public.garments
  where user_id = match_user_id
    and embedding is not null
    and archived_at is null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
