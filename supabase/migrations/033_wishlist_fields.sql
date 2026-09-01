-- Phase 9: 15a/w3a wishlist, stored as lookbook_entries with
-- source_type = 'wishlist' per DATA_MODEL.md's mapping table. That table
-- already covers name/image/productUrl (title/image_path/source_url);
-- this adds the price-tracking fields a wishlist item needs that a plain
-- inspiration entry doesn't.
alter table public.lookbook_entries
  add column if not exists price_cents integer check (price_cents is null or price_cents >= 0),
  add column if not exists original_price_cents integer check (original_price_cents is null or original_price_cents >= 0),
  add column if not exists currency text not null default 'AUD',
  add column if not exists category text,
  add column if not exists colour_family text,
  add column if not exists size text,
  add column if not exists watch_price boolean not null default true,
  add column if not exists resolved_state text not null default 'manual'
    check (resolved_state in ('resolving', 'resolved', 'manual', 'failed')),
  add column if not exists bought_garment_id uuid references public.garments(id) on delete set null;

create index if not exists lookbook_entries_wishlist_idx
  on public.lookbook_entries (user_id)
  where source_type = 'wishlist';
