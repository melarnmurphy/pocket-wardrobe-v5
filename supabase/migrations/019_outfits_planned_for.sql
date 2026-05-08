-- Adds a nullable planned_for date to outfits so the iOS planner
-- can store and query outfits by their intended wear date.
alter table public.outfits
  add column if not exists planned_for date;

create index if not exists outfits_planned_for_idx
  on public.outfits (user_id, planned_for)
  where planned_for is not null;
