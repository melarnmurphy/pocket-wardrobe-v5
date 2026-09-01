-- Phase 7: NearbyQuery.centre is "the user's suburb centroid, not their
-- device" (DATA_MODEL.md). Adds the centroid resolved from profiles.suburb
-- (see lib/domain/local-threads/adelaide-suburbs.ts) so the nearby feed has
-- a centre to search from without a geocoding API — "Adelaide-shaped",
-- matching the design's own scope.
alter table public.profiles
  add column if not exists suburb_lat numeric(9,6),
  add column if not exists suburb_lng numeric(9,6),
  add column if not exists radius_km integer not null default 30
    check (radius_km >= 5 and radius_km <= 100);
