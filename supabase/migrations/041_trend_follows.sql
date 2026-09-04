-- A user-toggled "follow" on a trend, distinct from user_trend_matches
-- (which is a computed, recomputable match score, not a deliberate signal
-- of interest). Lets app/api/cron/trend-expiry know who to notify when a
-- followed trend cools or goes flat.
create table if not exists public.trend_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, trend_signal_id)
);

create index if not exists trend_follows_trend_idx on public.trend_follows (trend_signal_id);
create index if not exists trend_follows_user_idx on public.trend_follows (user_id);

alter table public.trend_follows enable row level security;

create policy trend_follows_select_own on public.trend_follows
for select using (auth.uid() = user_id);

create policy trend_follows_insert_own on public.trend_follows
for insert with check (auth.uid() = user_id);

create policy trend_follows_delete_own on public.trend_follows
for delete using (auth.uid() = user_id);
