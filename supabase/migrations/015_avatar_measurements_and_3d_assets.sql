begin;

insert into storage.buckets (id, name, public)
values ('garment-3d-assets', 'garment-3d-assets', false)
on conflict (id) do nothing;

create table if not exists public.avatar_measurement_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_profile_id uuid references public.avatar_profiles(id) on delete set null,
  measurement_system text not null default 'metric'
    check (measurement_system in ('metric', 'imperial')),
  body_measurements_json jsonb not null default '{}'::jsonb,
  shape_profile_json jsonb not null default '{}'::jsonb,
  skin_tone_json jsonb not null default '{}'::jsonb,
  capture_method text not null default 'manual'
    check (capture_method in ('manual', 'photo_estimate', 'scan', 'partner_import')),
  source_type text not null default 'user_reported'
    check (source_type in ('user_reported', 'camera_capture', 'body_scan', 'partner_device', 'stylist_entry')),
  confidence numeric(5,2),
  status text not null default 'active'
    check (status in ('draft', 'active', 'superseded', 'archived')),
  provenance_metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garment_3d_assets (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('model', 'texture', 'material', 'simulation_preset', 'thumbnail')),
  storage_path text,
  file_format text,
  material_profile_json jsonb not null default '{}'::jsonb,
  physics_profile_json jsonb not null default '{}'::jsonb,
  renderer_metadata_json jsonb not null default '{}'::jsonb,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'designer_asset', 'generated', 'partner_import', 'scan')),
  confidence numeric(5,2),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'failed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_avatar_measurement_sets_user_id
on public.avatar_measurement_sets(user_id);

create index if not exists idx_avatar_measurement_sets_avatar_profile_id
on public.avatar_measurement_sets(avatar_profile_id);

create index if not exists idx_garment_3d_assets_garment_id
on public.garment_3d_assets(garment_id);

drop trigger if exists trg_avatar_measurement_sets_set_updated_at on public.avatar_measurement_sets;
create trigger trg_avatar_measurement_sets_set_updated_at
before update on public.avatar_measurement_sets
for each row
execute function public.set_updated_at();

drop trigger if exists trg_garment_3d_assets_set_updated_at on public.garment_3d_assets;
create trigger trg_garment_3d_assets_set_updated_at
before update on public.garment_3d_assets
for each row
execute function public.set_updated_at();

alter table public.avatar_measurement_sets enable row level security;
alter table public.garment_3d_assets enable row level security;

create policy avatar_measurement_sets_select_own on public.avatar_measurement_sets
for select using (auth.uid() = user_id);

create policy avatar_measurement_sets_insert_own on public.avatar_measurement_sets
for insert with check (auth.uid() = user_id);

create policy avatar_measurement_sets_update_own on public.avatar_measurement_sets
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy avatar_measurement_sets_delete_own on public.avatar_measurement_sets
for delete using (auth.uid() = user_id);

create policy garment_3d_assets_select_own on public.garment_3d_assets
for select using (
  exists (
    select 1 from public.garments g
    where g.id = garment_3d_assets.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_3d_assets_insert_own on public.garment_3d_assets
for insert with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_3d_assets.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_3d_assets_update_own on public.garment_3d_assets
for update using (
  exists (
    select 1 from public.garments g
    where g.id = garment_3d_assets.garment_id
      and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_3d_assets.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_3d_assets_delete_own on public.garment_3d_assets
for delete using (
  exists (
    select 1 from public.garments g
    where g.id = garment_3d_assets.garment_id
      and g.user_id = auth.uid()
  )
);

drop policy if exists "garment 3d assets insert own" on storage.objects;
create policy "garment 3d assets insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'garment-3d-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment 3d assets read own" on storage.objects;
create policy "garment 3d assets read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'garment-3d-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment 3d assets update own" on storage.objects;
create policy "garment 3d assets update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'garment-3d-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "garment 3d assets delete own" on storage.objects;
create policy "garment 3d assets delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'garment-3d-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
