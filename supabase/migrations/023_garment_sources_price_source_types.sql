-- Garderobe never holds a retailer login. Prices arrive by forwarded order email, a
-- photographed docket, a pasted product link, or the user typing it — see
-- docs/design/design_handoff_garderobe/DATA_MODEL.md ("Sources, receipts"). The only
-- accounts that ever connect are resale accounts (depop, vestiaire), and only so that
-- buying there adds a piece and selling there removes one.
--
-- This widens garment_sources.source_type to cover those price-source kinds. It does not
-- add, and must never add, a type implying an OAuth or credential login to a retailer:
-- if a retailer can't be read safely via a public API, or via a receipt/forward the user
-- already controls, it is out of scope rather than modelled here.
alter table public.garment_sources
  drop constraint if exists garment_sources_source_type_check;

alter table public.garment_sources
  add constraint garment_sources_source_type_check check (
    source_type in (
      -- how a garment itself entered the wardrobe
      'direct_upload',
      'product_url',
      'website_image',
      'outfit_decomposition',
      'manual_entry',
      -- how a price attached to a garment (10a, 13a, 13b, 15b)
      'forwarded_email',
      'read_email',
      'docket_photo',
      'pdf',
      'screenshot',
      'resale_account',
      -- retained for existing rows written before this migration
      'receipt'
    )
  );
