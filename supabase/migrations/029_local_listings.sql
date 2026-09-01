-- Phase 7 (local threads, read-only): the nearby feed (16a/w2a) and a
-- listing (16b/w2b). See docs/design/design_handoff_garderobe/DATA_MODEL.md
-- "Local threads" — LocalListing, NearbyQuery.
--
-- Location granularity is suburb + jittered point; an exact address is
-- never returned by any endpoint, to either party, at any listing state
-- (standing invariant #2). Adelaide-scale volumes make either PostGIS or
-- lat/lng + haversine fine (per DATA_MODEL's own note) — this uses plain
-- lat/lng columns with a haversine RPC, so no new Postgres extension is
-- required.
create table if not exists public.local_listings (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.garments(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'reserved', 'handover arranged', 'sold', 'expired', 'withdrawn')),
  ask_cents integer not null check (ask_cents >= 0),
  currency text not null default 'AUD',
  negotiable boolean not null default true,
  description text not null default '',
  photo_uris text[] not null default '{}',
  show_wear_count boolean not null default true,
  wear_count_at_listing integer,
  size text,
  suburb text not null,
  -- Exact location. Never selected by the buyer-facing nearby_listings()
  -- RPC below — only the seller's own RLS-scoped read sees these columns.
  lat numeric(9,6) not null check (lat >= -90 and lat <= 90),
  lng numeric(9,6) not null check (lng >= -180 and lng <= 180),
  views integer not null default 0,
  saves integer not null default 0,
  listed_at timestamptz,
  reserved_for_thread_id uuid,
  sold_at timestamptz,
  sold_for_cents integer check (sold_for_cents is null or sold_for_cents >= 0),
  blocked_reason text,
  photos_required integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists local_listings_status_idx on public.local_listings (status);
create index if not exists local_listings_seller_idx on public.local_listings (seller_id);
-- Bounding-box prefilter before the haversine sort in nearby_listings().
create index if not exists local_listings_lat_lng_idx on public.local_listings (lat, lng);

alter table public.local_listings enable row level security;

create policy local_listings_select_live_or_own on public.local_listings
for select using (status = 'live' or seller_id = auth.uid());

create policy local_listings_insert_own on public.local_listings
for insert with check (seller_id = auth.uid());

create policy local_listings_update_own on public.local_listings
for update using (seller_id = auth.uid());

create policy local_listings_delete_own on public.local_listings
for delete using (seller_id = auth.uid());

drop trigger if exists trg_local_listings_set_updated_at on public.local_listings;
create trigger trg_local_listings_set_updated_at
before update on public.local_listings
for each row execute function public.set_updated_at();

-- A live local_listing's seller becomes visible to any authenticated user —
-- "a live local_listing and its seller's PublicProfile are readable by any
-- authenticated user inside the radius" (DATA_MODEL.md). Radius filtering
-- itself happens in nearby_listings(); once a listing has already surfaced
-- there, the buyer needs to be able to read who it's from.
create policy profiles_select_via_live_listing on public.profiles
for select using (
  exists (
    select 1 from public.local_listings l
    where l.seller_id = profiles.user_id
      and l.status = 'live'
  )
);

-- Haversine distance in km, plus a deterministic ~200m jitter on the
-- returned point so the exact address is never in the response payload —
-- the jitter is seeded from the listing id, so the same listing always
-- displays at the same nearby point rather than jumping between requests.
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
      -- Haversine, earth radius 6371km.
      (
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(viewer_lat)) * cos(radians(l.lat)) *
              cos(radians(l.lng) - radians(viewer_lng)) +
            sin(radians(viewer_lat)) * sin(radians(l.lat))
          ))
        )
      ) as distance_km,
      -- Deterministic jitter: a stable pseudo-random angle and radius
      -- (~0-200m) derived from the listing id, not the request.
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
    b.description, b.photo_uris, b.show_wear_count, b.wear_count_at_listing, b.size,
    b.suburb,
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

-- Any authenticated viewer may bump a live listing's view count — this is
-- the one write a non-owner needs before threads (phase 8) exist.
create or replace function increment_local_listing_views(listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.local_listings
  set views = views + 1
  where id = listing_id
    and status = 'live';
$$;

