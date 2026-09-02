-- Phase 12 (missing wardrobe dialogs): "retire / store for the season" is a
-- second reversible flag alongside archived_at/let_go_added_at (migration
-- 024) and deleted_at (migration 035). Per MODALS.md's own note on this row
-- ("the piece still counts in the totals") and the standing invariant in
-- lib/domain/wardrobe/index.ts ("a piece stays in the wardrobe and in counts
-- while merely unavailable"), this column never changes what
-- getDashboardStats or listWardrobeGarments count — it only records that a
-- piece has been tucked away for the season, reversible with one tap.
alter table public.garments
  add column if not exists seasonally_stored_at timestamptz;

create index if not exists garments_user_seasonal_storage_idx
  on public.garments (user_id) where seasonally_stored_at is not null;
