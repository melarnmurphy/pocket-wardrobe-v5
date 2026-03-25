-- supabase/migrations/005_trend_signal_embeddings.sql

create extension if not exists vector;

alter table public.trend_signals
  add column if not exists embedding vector(1536);

create index if not exists trend_signals_embedding_hnsw_idx
  on public.trend_signals
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create or replace function match_trend_signals(
  query_embedding vector(1536),
  match_threshold float default 0.6,
  match_count int default 10
)
returns table (
  id uuid,
  trend_type text,
  label text,
  normalized_attributes_json jsonb,
  season text,
  year int,
  region text,
  source_count int,
  authority_score float,
  confidence_score float,
  last_seen_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    id, trend_type, label, normalized_attributes_json,
    season, year, region, source_count,
    authority_score::float, confidence_score::float, last_seen_at,
    1 - (embedding <=> query_embedding) as similarity
  from public.trend_signals
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
