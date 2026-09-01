-- Phase 4 (prices): DATA_MODEL.md's Piece.priceSource ('store' | 'receipt' |
-- 'manual' | null) — which of the four ways a price arrived (forwarded
-- email, photographed docket, pasted link, or typed by hand) so 15b/13a can
-- say how the price got in, not just what it is.
alter table public.garments
  add column if not exists price_source text
    check (price_source is null or price_source in ('store', 'receipt', 'manual'));
