-- Phase 10 ("the edges"): 6a/w4a-w4c onboarding and 9f notifications.
--
-- Onboarding progress lives on profiles (this repo's per-user settings
-- row, added in phase 6) rather than a new table — DATA_MODEL.md's
-- User.onboarding is meant to let web and phone resume each other, and a
-- single row per user is exactly what that needs.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- 9f notifications — DATA_MODEL.md's AppNotification. Scoped in this pass
-- to what already has a real trigger point (a new local-threads message);
-- other kinds (price drop, trend expiry, offer, sold, receipt read, wear
-- reminder, batch finished) have no event-writing code anywhere yet and
-- are left for whichever phase actually builds each trigger, rather than
-- populating this table with events nothing produces.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'price drop', 'trend expiry', 'offer', 'sold', 'orders waiting',
      'receipt read', 'wear reminder', 'batch finished', 'message'
    )
  ),
  title text not null,
  body text not null,
  subject_kind text check (subject_kind in ('piece', 'wishlist', 'listing', 'trend', 'batch', 'thread')),
  subject_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists app_notifications_user_idx on public.app_notifications (user_id, created_at desc);

alter table public.app_notifications enable row level security;

create policy app_notifications_select_own on public.app_notifications
for select using (auth.uid() = user_id);

create policy app_notifications_update_own on public.app_notifications
for update using (auth.uid() = user_id);
