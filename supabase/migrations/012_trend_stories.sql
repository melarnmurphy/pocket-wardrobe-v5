-- supabase/migrations/012_trend_stories.sql

create table if not exists public.trend_stories (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  framing text,
  momentum_label text,
  dominant_type text check (
    dominant_type in ('colour_combo', 'garment_moment', 'aesthetic', 'it_girl_look', 'runway_moment')
    or dominant_type is null
  ),
  attributed_houses text[] not null default '{}',
  attributed_people text[] not null default '{}',
  signal_ids uuid[] not null default '{}',
  status text check (
    status in ('candidate', 'emerging', 'confirmed', 'dominant', 'cooling', 'flat', 'rising')
    or status is null
  ),
  confidence_score numeric(5,2),
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.trend_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  first_seen_at timestamptz not null default now(),
  mention_count integer not null default 1,
  last_seen_at timestamptz not null default now()
);

alter table public.trend_signals
  add column if not exists house_attribution text[],
  add column if not exists person_attribution text[];

alter table public.user_trend_matches
  add column if not exists story_id uuid references public.trend_stories(id) on delete set null;

create index if not exists idx_trend_stories_refreshed_at
  on public.trend_stories(refreshed_at desc);
create index if not exists idx_trend_stories_confidence
  on public.trend_stories(confidence_score desc nulls last);
create index if not exists idx_trend_stories_signal_ids
  on public.trend_stories using gin(signal_ids);
create index if not exists idx_user_trend_matches_story_id
  on public.user_trend_matches(story_id);
create index if not exists idx_trend_signals_house_attribution
  on public.trend_signals using gin(house_attribution);
