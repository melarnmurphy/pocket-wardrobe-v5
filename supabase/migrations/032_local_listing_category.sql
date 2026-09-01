-- Phase 9: the nearby feed's "finishes a look" sort needs each listing's
-- category/subcategory to score it against the viewer's own wardrobe (see
-- lib/domain/outfits/unlock.ts's unlockCountForCandidate). A buyer can't
-- read the seller's private garments row (RLS is per-user), so this
-- denormalises category onto the listing itself at listing time, the same
-- way description and photo_uris already are.
alter table public.local_listings
  add column if not exists category text not null default 'other',
  add column if not exists subcategory text;

alter table public.local_listings alter column category drop default;

-- nearby_listings() must be dropped and recreated (not create-or-replace)
-- because its returns table(...) shape is changing.
drop function if exists nearby_listings(numeric, numeric, numeric, integer, text);

create or replace function nearby_listings(
  viewer_lat numeric,
  viewer_lng numeric,
  radius_km numeric default 30,
  max_price_cents integer default null,
  sort_key text default 'closest'
)
returns table (
  id uuid,
  piece_id uuid,
  seller_id uuid,
  status text,
  ask_cents integer,
  currency text,
  negotiable boolean,
  description text,
  category text,
  subcategory text,
  photo_uris text[],
  show_wear_count boolean,
  wear_count_at_listing integer,
  size text,
  suburb text,
  display_lat numeric,
  display_lng numeric,
  distance_km numeric,
  views integer,
  saves integer,
  listed_at timestamptz,
  created_at timestamptz
)
language sql stable
as $$
  with candidates as (
    select
      l.*,
      (
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(viewer_lat)) * cos(radians(l.lat)) *
              cos(radians(l.lng) - radians(viewer_lng)) +
            sin(radians(viewer_lat)) * sin(radians(l.lat))
          ))
        )
      ) as distance_km,
      (('x' || substr(md5(l.id::text), 1, 8))::bit(32)::bigint % 1000) / 1000.0 as jitter_a,
      (('x' || substr(md5(l.id::text || 'b'), 1, 8))::bit(32)::bigint % 1000) / 1000.0 as jitter_b
    from public.local_listings l
    where l.status = 'live'
      and (max_price_cents is null or l.ask_cents <= max_price_cents)
  ),
  bounded as (
    select *
    from candidates
    where distance_km <= radius_km
  )
  select
    b.id, b.piece_id, b.seller_id, b.status, b.ask_cents, b.currency, b.negotiable,
    b.description, b.category, b.subcategory, b.photo_uris, b.show_wear_count,
    b.wear_count_at_listing, b.size, b.suburb,
    b.lat + (b.jitter_b * 0.0018 * cos(2 * pi() * b.jitter_a)) as display_lat,
    b.lng + (b.jitter_b * 0.0018 * sin(2 * pi() * b.jitter_a)) as display_lng,
    round(b.distance_km::numeric, 2) as distance_km,
    b.views, b.saves, b.listed_at, b.created_at
  from bounded b
  order by
    case when sort_key = 'newest' then b.listed_at end desc nulls last,
    case when sort_key = 'price' then b.ask_cents end asc,
    b.distance_km asc;
$$;
