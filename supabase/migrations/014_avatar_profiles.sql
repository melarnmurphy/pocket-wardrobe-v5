begin;

insert into storage.buckets (id, name, public)
values ('avatar-photos', 'avatar-photos', false)
on conflict (id) do nothing;

create table if not exists public.avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_storage_path text,
  layout_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint avatar_profiles_user_id_uq unique (user_id)
);

create index if not exists avatar_profiles_user_id_idx
on public.avatar_profiles(user_id);

drop trigger if exists avatar_profiles_set_updated_at on public.avatar_profiles;
create trigger avatar_profiles_set_updated_at
before update on public.avatar_profiles
for each row execute function public.set_updated_at();

alter table public.avatar_profiles enable row level security;

drop policy if exists avatar_profiles_select_own on public.avatar_profiles;
create policy avatar_profiles_select_own on public.avatar_profiles
for select using (auth.uid() = user_id);

drop policy if exists avatar_profiles_insert_own on public.avatar_profiles;
create policy avatar_profiles_insert_own on public.avatar_profiles
for insert with check (auth.uid() = user_id);

drop policy if exists avatar_profiles_update_own on public.avatar_profiles;
create policy avatar_profiles_update_own on public.avatar_profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avatar_profiles_delete_own on public.avatar_profiles;
create policy avatar_profiles_delete_own on public.avatar_profiles
for delete using (auth.uid() = user_id);

drop policy if exists "avatar photos insert own" on storage.objects;
create policy "avatar photos insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatar-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar photos read own" on storage.objects;
create policy "avatar photos read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatar-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar photos update own" on storage.objects;
create policy "avatar photos update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatar-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar photos delete own" on storage.objects;
create policy "avatar photos delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatar-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
