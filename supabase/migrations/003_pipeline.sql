-- 003_pipeline.sql
-- Change garments.embedding from vector(1536) to vector(768)
-- to match Marqo-FashionSigLIP output dimensions.
-- Safe to run: no existing rows have embeddings yet.

begin;

alter table public.garments
  drop column if exists embedding;

alter table public.garments
  add column embedding vector(768);

-- Index for similarity search (cosine distance)
create index if not exists garments_embedding_idx
  on public.garments
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

commit;
