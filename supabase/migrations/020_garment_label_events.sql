-- Captures every wardrobe draft review action (confirm / correct / reject) as a
-- labeled training example for future detector fine-tuning. Append-only, RLS by user.
create table if not exists public.garment_label_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_id uuid,
  garment_id uuid,
  source_id uuid,
  event_type text not null check (event_type in ('confirmed', 'corrected', 'rejected')),
  corrected_fields text[] not null default '{}',
  source_storage_path text,
  crop_path text,
  bbox jsonb,
  crop_width integer,
  crop_height integer,
  model_category text,
  model_colour text,
  model_material text,
  model_style text,
  model_brand text,
  model_confidence numeric,
  model_field_confidence jsonb,
  final_category text,
  final_colour text,
  final_material text,
  final_style text,
  final_brand text,
  final_title text,
  created_at timestamptz not null default now()
);

create index if not exists garment_label_events_user_created_idx
  on public.garment_label_events (user_id, created_at);

alter table public.garment_label_events enable row level security;

create policy garment_label_events_select_own on public.garment_label_events
  for select using (auth.uid() = user_id);

create policy garment_label_events_insert_own on public.garment_label_events
  for insert with check (auth.uid() = user_id);
