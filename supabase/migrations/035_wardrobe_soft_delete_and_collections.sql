-- Phase 11 (wardrobe dialogs, turn 18 / w6): "delete N pieces" and "recently
-- deleted / restore" need a soft-delete window distinct from the archive/
-- let-go flow (archived_at, migration 024) — an archived piece stays in the
-- wardrobe and its counts on purpose; a deleted one should not. merged_into_id
-- gives "merge these two" an audit trail instead of silently vanishing a row.
alter table public.garments
  add column if not exists deleted_at timestamptz,
  add column if not exists merged_into_id uuid references public.garments(id);

create index if not exists garments_user_deleted_idx
  on public.garments (user_id) where deleted_at is not null;

-- Collection — DATA_MODEL.md "Collection". A join table rather than an
-- array column so a piece can sit in more than one collection and so RLS
-- can be scoped per row like every other user-owned table here.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'user' check (kind in ('user', 'batch', 'packing')),
  created_at timestamptz not null default now()
);

create table if not exists public.garment_collections (
  collection_id uuid not null references public.collections(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, garment_id)
);

alter table public.collections enable row level security;
alter table public.garment_collections enable row level security;

create policy collections_select_own on public.collections
  for select using (auth.uid() = user_id);

create policy collections_insert_own on public.collections
  for insert with check (auth.uid() = user_id);

create policy collections_update_own on public.collections
  for update using (auth.uid() = user_id);

create policy collections_delete_own on public.collections
  for delete using (auth.uid() = user_id);

create policy garment_collections_select_own on public.garment_collections
  for select using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );

create policy garment_collections_insert_own on public.garment_collections
  for insert with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );

create policy garment_collections_delete_own on public.garment_collections
  for delete using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
