-- Phase 5: the look canvas (6d, w1b) — cut-outs arranged with a mouse.
-- DATA_MODEL.md's Placement: x, y, z (canvas units, 0-1 of the canvas box),
-- scale, rotation. Null until a piece has been placed; a freshly-created
-- outfit_items row has no position yet.
alter table public.outfit_items
  add column if not exists placement_x numeric(6,4)
    check (placement_x is null or (placement_x >= 0 and placement_x <= 1)),
  add column if not exists placement_y numeric(6,4)
    check (placement_y is null or (placement_y >= 0 and placement_y <= 1)),
  add column if not exists placement_z integer,
  add column if not exists placement_scale numeric(5,3) check (placement_scale is null or placement_scale > 0),
  add column if not exists placement_rotation numeric(6,2);
