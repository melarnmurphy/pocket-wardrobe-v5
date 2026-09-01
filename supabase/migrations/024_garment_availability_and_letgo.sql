-- Phase 2 (wardrobe spine): availability (9a) and the let-go list (9b) are
-- distinct from wardrobe_status. A piece stays in the wardrobe and in counts
-- while it is merely unavailable (in the wash, at the tailor, lent out,
-- packed, listed for sale); it only leaves on archival, which is tracked
-- separately so wear history survives. See
-- docs/design/design_handoff_garderobe/DATA_MODEL.md ("Piece", "LetGoState").
alter table public.garments
  add column if not exists availability text not null default 'wearable'
    check (availability in (
      'wearable',
      'in the wash',
      'at the tailor',
      'lent out',
      'packed',
      'listed for sale'
    )),
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists let_go_reason text
    check (let_go_reason is null or let_go_reason in (
      'never worn',
      'does not fit',
      'not me anymore',
      'worn out',
      'duplicate'
    )),
  add column if not exists let_go_added_at timestamptz,
  add column if not exists let_go_estimate_cents integer check (let_go_estimate_cents is null or let_go_estimate_cents >= 0);

create index if not exists garments_user_availability_idx on public.garments (user_id, availability);
create index if not exists garments_user_let_go_idx on public.garments (user_id) where let_go_reason is not null;
create index if not exists garments_user_archived_idx on public.garments (user_id) where archived_at is not null;
