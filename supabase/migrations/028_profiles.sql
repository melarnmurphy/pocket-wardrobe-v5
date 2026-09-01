-- Phase 6 ("you"): 17a/w3e — local name, suburb, sizes, height, and the
-- LocalPrivacy toggles that decide what a stranger in local threads ever
-- sees. This is deliberately a new table rather than reusing
-- avatar_profiles/avatar_measurement_sets, which are a different feature
-- (2D outfit-styling boards and provenance-tracked body-scan data) — see
-- docs/design/design_handoff_garderobe/DATA_MODEL.md "Public profile and
-- sizes". No signup trigger exists in this repo, so a row is created lazily
-- on first read/write (see lib/domain/profile/service.ts), not at signup.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  local_name text,
  suburb text,
  tops_size text,
  bottoms_size text,
  shoes_size text,
  tops_size_system text not null default 'AU' check (tops_size_system in ('AU', 'UK', 'US', 'EU')),
  bottoms_size_system text not null default 'AU' check (bottoms_size_system in ('AU', 'UK', 'US', 'EU')),
  shoes_size_system text not null default 'AU' check (shoes_size_system in ('AU', 'UK', 'US', 'EU')),
  height_cm integer check (height_cm is null or (height_cm > 0 and height_cm < 300)),
  one_size_either_way boolean not null default false,
  -- LocalPrivacy — defaults match DATA_MODEL.md exactly.
  show_suburb boolean not null default true,
  show_wear_count boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id);

-- Cross-user visibility (a stranger reading a seller's public profile in
-- local threads) is deliberately not granted here — phase 6 only builds
-- the self-preview of "what other people see". A scoped policy limited to
-- users near a live listing is added in phase 7 alongside local_listings.

create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
