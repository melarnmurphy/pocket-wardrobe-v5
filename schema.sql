-- Pocket Wardrobe schema.sql
-- Opinionated Supabase/Postgres schema for a wardrobe operating system.
-- Includes wardrobe, lookbook, outfits, style rules, colour intelligence,
-- trend intelligence, async job tracking, helper functions, indexes, RLS,
-- and storage bucket setup.

begin;

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- =============================================================================
-- Utility functions
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.recalculate_garment_cost_per_wear(p_garment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_price numeric(12,2);
  v_wear_count integer;
begin
  select purchase_price, wear_count
  into v_purchase_price, v_wear_count
  from public.garments
  where id = p_garment_id;

  update public.garments
  set cost_per_wear = case
    when v_purchase_price is null then null
    when greatest(coalesce(v_wear_count, 0), 1) = 0 then null
    else round(v_purchase_price / greatest(coalesce(v_wear_count, 0), 1), 2)
  end,
      updated_at = now()
  where id = p_garment_id;
end;
$$;

create or replace function public.sync_garment_wear_stats_from_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_garment_id uuid;
begin
  v_target_garment_id := coalesce(new.garment_id, old.garment_id);

  update public.garments g
  set wear_count = sub.cnt,
      last_worn_at = sub.last_worn_at,
      updated_at = now()
  from (
    select garment_id,
           count(*)::integer as cnt,
           max(worn_at) as last_worn_at
    from public.wear_events
    where garment_id = v_target_garment_id
    group by garment_id
  ) sub
  where g.id = sub.garment_id;

  update public.garments
  set wear_count = 0,
      last_worn_at = null,
      updated_at = now()
  where id = v_target_garment_id
    and not exists (
      select 1
      from public.wear_events we
      where we.garment_id = v_target_garment_id
    );

  perform public.recalculate_garment_cost_per_wear(v_target_garment_id);

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_garment_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.purchase_price is distinct from old.purchase_price
     or new.wear_count is distinct from old.wear_count then
    perform public.recalculate_garment_cost_per_wear(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.is_global_rule(rule_scope text)
returns boolean
language sql
immutable
as $$
  select rule_scope = 'global'
$$;

-- =============================================================================
-- Core wardrobe tables
-- =============================================================================

create table if not exists public.garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  brand text,
  category text not null,
  subcategory text,
  pattern text,
  material text,
  size text,
  fit text,
  formality_level text,
  seasonality text[] not null default '{}',
  wardrobe_status text not null default 'active'
    check (wardrobe_status in ('active', 'archived', 'in_laundry', 'packed', 'sold', 'donated', 'unavailable')),
  purchase_price numeric(12,2),
  purchase_currency text,
  purchase_date date,
  retailer text,
  wear_count integer not null default 0,
  last_worn_at timestamptz,
  cost_per_wear numeric(12,2),
  favourite_score numeric(5,2),
  versatility_score numeric(5,2),
  embedding vector(1536),
  extraction_metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garment_sources (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid references public.garments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'direct_upload',
      'product_url',
      'website_image',
      'receipt',
      'outfit_decomposition',
      'manual_entry'
    )
  ),
  original_url text,
  storage_path text,
  raw_text text,
  source_metadata_json jsonb not null default '{}'::jsonb,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'processing', 'completed', 'failed', 'requires_review')),
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

create table if not exists public.garment_images (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  image_type text not null check (
    image_type in ('original', 'cutout', 'cropped', 'thumbnail')
  ),
  storage_path text not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table if not exists public.garment_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.garment_sources(id) on delete cascade,
  draft_payload_json jsonb not null,
  confidence numeric(5,2),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.wear_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  worn_at timestamptz not null default now(),
  occasion text,
  notes text,
  outfit_id uuid,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Lookbook and outfits
-- =============================================================================

create table if not exists public.lookbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  source_type text not null
    check (source_type in ('manual', 'uploaded_image', 'editorial_reference', 'wishlist', 'ai_generated', 'outfit_reference')),
  source_url text,
  image_path text,
  aesthetic_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.lookbook_items (
  id uuid primary key default gen_random_uuid(),
  lookbook_entry_id uuid not null references public.lookbook_entries(id) on delete cascade,
  garment_id uuid references public.garments(id) on delete set null,
  desired_item_json jsonb,
  role text,
  created_at timestamptz not null default now(),
  constraint lookbook_items_has_reference check (
    garment_id is not null or desired_item_json is not null
  )
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  occasion text,
  dress_code text,
  weather_context_json jsonb not null default '{}'::jsonb,
  explanation text,
  explanation_json jsonb not null default '{}'::jsonb,
  source_type text not null default 'generated'
    check (source_type in ('generated', 'manual', 'imported', 'planner')),
  created_at timestamptz not null default now()
);

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  role text not null check (
    role in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'bag', 'jewellery', 'other')
  ),
  created_at timestamptz not null default now(),
  unique (outfit_id, garment_id, role)
);

alter table public.wear_events
  add constraint wear_events_outfit_id_fkey
  foreign key (outfit_id) references public.outfits(id) on delete set null;

-- =============================================================================
-- Colour intelligence
-- =============================================================================

create table if not exists public.colours (
  id uuid primary key default gen_random_uuid(),
  hex text not null unique,
  rgb_r integer not null check (rgb_r between 0 and 255),
  rgb_g integer not null check (rgb_g between 0 and 255),
  rgb_b integer not null check (rgb_b between 0 and 255),
  lab_l numeric(8,4),
  lab_a numeric(8,4),
  lab_b numeric(8,4),
  lch_l numeric(8,4),
  lch_c numeric(8,4),
  lch_h numeric(8,4),
  family text not null,
  undertone text check (undertone in ('warm', 'cool', 'neutral') or undertone is null),
  saturation_band text check (saturation_band in ('low', 'medium', 'high') or saturation_band is null),
  lightness_band text check (lightness_band in ('low', 'medium', 'high') or lightness_band is null),
  neutral_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.garment_colours (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  colour_id uuid not null references public.colours(id) on delete cascade,
  dominance numeric(5,4) not null check (dominance >= 0 and dominance <= 1),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.colour_relationships (
  id uuid primary key default gen_random_uuid(),
  colour_id_a uuid not null references public.colours(id) on delete cascade,
  colour_id_b uuid not null references public.colours(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in (
      'complementary',
      'analogous',
      'split_complementary',
      'triadic',
      'tonal',
      'neutral_pairing',
      'high_contrast',
      'low_contrast',
      'monochrome',
      'warm_cool_balance'
    )
  ),
  score numeric(5,4) not null,
  created_at timestamptz not null default now(),
  unique (colour_id_a, colour_id_b, relationship_type)
);

-- =============================================================================
-- Style rules / knowledge graph
-- =============================================================================

create table if not exists public.style_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null,
  subject_type text not null,
  subject_value text not null,
  predicate text not null,
  object_type text not null,
  object_value text not null,
  weight numeric(5,2) not null default 1.0,
  rule_scope text not null default 'global'
    check (rule_scope in ('global', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint style_rules_user_scope_consistency check (
    (rule_scope = 'global' and user_id is null)
    or
    (rule_scope = 'user' and user_id is not null)
  )
);

-- =============================================================================
-- Trend intelligence
-- =============================================================================

create table if not exists public.trend_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text not null check (
    source_type in (
      'rss',
      'sitemap',
      'press_release',
      'brand_newsroom',
      'manual_curated',
      'trend_report',
      'runway_coverage',
      'fashion_publication'
    )
  ),
  source_url text not null,
  title text not null,
  publish_date timestamptz,
  author text,
  region text,
  season text,
  raw_text_excerpt text,
  ingestion_timestamp timestamptz not null default now()
);

create table if not exists public.trend_signals (
  id uuid primary key default gen_random_uuid(),
  trend_type text not null check (
    trend_type in (
      'colour',
      'garment',
      'silhouette',
      'material',
      'pattern',
      'styling',
      'occasion',
      'aesthetic',
      'era_influence'
    )
  ),
  label text not null,
  normalized_attributes_json jsonb not null default '{}'::jsonb,
  season text,
  year integer,
  region text,
  source_count integer not null default 0,
  authority_score numeric(5,2),
  recency_score numeric(5,2),
  confidence_score numeric(5,2),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trend_signal_sources (
  id uuid primary key default gen_random_uuid(),
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  trend_source_id uuid not null references public.trend_sources(id) on delete cascade,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (trend_signal_id, trend_source_id)
);

create table if not exists public.trend_colours (
  id uuid primary key default gen_random_uuid(),
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  colour_id uuid references public.colours(id) on delete set null,
  source_name text not null,
  source_label text,
  source_url text,
  canonical_hex text not null,
  canonical_rgb jsonb not null,
  canonical_lab jsonb,
  canonical_lch jsonb,
  family text,
  undertone text check (undertone in ('warm', 'cool', 'neutral') or undertone is null),
  saturation_band text check (saturation_band in ('low', 'medium', 'high') or saturation_band is null),
  lightness_band text check (lightness_band in ('low', 'medium', 'high') or lightness_band is null),
  importance_score numeric(5,2),
  observed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_trend_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  match_type text not null check (
    match_type in ('exact_match', 'adjacent_match', 'styling_match', 'missing_piece')
  ),
  score numeric(5,2) not null,
  reasoning_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, trend_signal_id, match_type)
);

create table if not exists public.trend_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in ('source_ingestion', 'signal_extraction', 'aggregation', 'scoring', 'embedding_refresh', 'user_matching')
  ),
  status text not null check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);

-- =============================================================================
-- Weather and occasion support
-- =============================================================================

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  location_key text not null,
  weather_date date not null,
  temp_min numeric(5,2),
  temp_max numeric(5,2),
  conditions text,
  precipitation_chance numeric(5,2),
  created_at timestamptz not null default now(),
  unique (user_id, location_key, weather_date)
);

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_tier text not null default 'free'
    check (plan_tier in ('free', 'pro', 'premium')),
  feature_labels_enabled boolean not null default false,
  receipt_ocr_enabled boolean not null default false,
  product_url_ingestion_enabled boolean not null default false,
  outfit_decomposition_enabled boolean not null default false,
  billing_provider text,
  billing_customer_id text,
  billing_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.occasion_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  constraints_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Optional async processing support
-- =============================================================================

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'image_analysis',
      'receipt_parsing',
      'outfit_decomposition',
      'colour_extraction',
      'embedding_generation',
      'garment_classification'
    )
  ),
  status text not null check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  target_table text,
  target_id uuid,
  input_payload_json jsonb not null default '{}'::jsonb,
  result_payload_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists idx_garments_user_id on public.garments(user_id);
create index if not exists idx_garments_category on public.garments(category);
create index if not exists idx_garments_brand on public.garments(brand);
create index if not exists idx_garments_status on public.garments(wardrobe_status);
create index if not exists idx_garments_last_worn_at on public.garments(last_worn_at desc);
create index if not exists idx_garments_created_at on public.garments(created_at desc);

create index if not exists idx_garment_sources_user_id on public.garment_sources(user_id);
create index if not exists idx_garment_sources_garment_id on public.garment_sources(garment_id);
create index if not exists idx_garment_drafts_user_id on public.garment_drafts(user_id);

create index if not exists idx_wear_events_user_id on public.wear_events(user_id);
create index if not exists idx_wear_events_garment_id on public.wear_events(garment_id);
create index if not exists idx_wear_events_worn_at on public.wear_events(worn_at desc);

create index if not exists idx_lookbook_entries_user_id on public.lookbook_entries(user_id);
create index if not exists idx_outfits_user_id on public.outfits(user_id);

create index if not exists idx_garment_colours_garment_id on public.garment_colours(garment_id);
create index if not exists idx_garment_colours_colour_id on public.garment_colours(colour_id);
create index if not exists idx_colour_relationships_a on public.colour_relationships(colour_id_a);
create index if not exists idx_colour_relationships_b on public.colour_relationships(colour_id_b);

create index if not exists idx_style_rules_scope on public.style_rules(rule_scope);
create index if not exists idx_style_rules_user_id on public.style_rules(user_id);
create index if not exists idx_style_rules_subject on public.style_rules(subject_type, subject_value);

create index if not exists idx_trend_sources_publish_date on public.trend_sources(publish_date desc);
create index if not exists idx_trend_signals_type on public.trend_signals(trend_type);
create index if not exists idx_trend_signals_label on public.trend_signals(label);
create index if not exists idx_user_trend_matches_user_id on public.user_trend_matches(user_id);
create index if not exists idx_weather_snapshots_user_id on public.weather_snapshots(user_id);
create index if not exists idx_user_entitlements_plan_tier on public.user_entitlements(plan_tier);
create index if not exists idx_processing_jobs_status on public.processing_jobs(status);

-- =============================================================================
-- Triggers
-- =============================================================================

drop trigger if exists trg_garments_set_updated_at on public.garments;
create trigger trg_garments_set_updated_at
before update on public.garments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_processing_jobs_set_updated_at on public.processing_jobs;
create trigger trg_processing_jobs_set_updated_at
before update on public.processing_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_entitlements_set_updated_at on public.user_entitlements;
create trigger trg_user_entitlements_set_updated_at
before update on public.user_entitlements
for each row
execute function public.set_updated_at();

drop trigger if exists trg_garments_price_change on public.garments;
create trigger trg_garments_price_change
after update of purchase_price, wear_count on public.garments
for each row
execute function public.handle_garment_price_change();

drop trigger if exists trg_wear_events_sync_stats_insert on public.wear_events;
create trigger trg_wear_events_sync_stats_insert
after insert on public.wear_events
for each row
execute function public.sync_garment_wear_stats_from_events();

drop trigger if exists trg_wear_events_sync_stats_update on public.wear_events;
create trigger trg_wear_events_sync_stats_update
after update on public.wear_events
for each row
execute function public.sync_garment_wear_stats_from_events();

drop trigger if exists trg_wear_events_sync_stats_delete on public.wear_events;
create trigger trg_wear_events_sync_stats_delete
after delete on public.wear_events
for each row
execute function public.sync_garment_wear_stats_from_events();

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.garments enable row level security;
alter table public.garment_sources enable row level security;
alter table public.garment_images enable row level security;
alter table public.garment_drafts enable row level security;
alter table public.wear_events enable row level security;
alter table public.lookbook_entries enable row level security;
alter table public.lookbook_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.garment_colours enable row level security;
alter table public.user_trend_matches enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.occasion_profiles enable row level security;
alter table public.processing_jobs enable row level security;

alter table public.colours enable row level security;
alter table public.colour_relationships enable row level security;
alter table public.style_rules enable row level security;
alter table public.trend_sources enable row level security;
alter table public.trend_signals enable row level security;
alter table public.trend_signal_sources enable row level security;
alter table public.trend_colours enable row level security;
alter table public.trend_ingestion_jobs enable row level security;

-- User-owned table policies

create policy garments_select_own on public.garments
for select using (auth.uid() = user_id);

create policy garments_insert_own on public.garments
for insert with check (auth.uid() = user_id);

create policy garments_update_own on public.garments
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy garments_delete_own on public.garments
for delete using (auth.uid() = user_id);

create policy garment_sources_select_own on public.garment_sources
for select using (auth.uid() = user_id);

create policy garment_sources_insert_own on public.garment_sources
for insert with check (auth.uid() = user_id);

create policy garment_sources_update_own on public.garment_sources
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy garment_sources_delete_own on public.garment_sources
for delete using (auth.uid() = user_id);

create policy garment_images_select_own on public.garment_images
for select using (
  exists (
    select 1 from public.garments g
    where g.id = garment_images.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_images_insert_own on public.garment_images
for insert with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_images.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_images_update_own on public.garment_images
for update using (
  exists (
    select 1 from public.garments g
    where g.id = garment_images.garment_id
      and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_images.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_images_delete_own on public.garment_images
for delete using (
  exists (
    select 1 from public.garments g
    where g.id = garment_images.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_drafts_select_own on public.garment_drafts
for select using (auth.uid() = user_id);

create policy garment_drafts_insert_own on public.garment_drafts
for insert with check (auth.uid() = user_id);

create policy garment_drafts_update_own on public.garment_drafts
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy garment_drafts_delete_own on public.garment_drafts
for delete using (auth.uid() = user_id);

create policy wear_events_select_own on public.wear_events
for select using (auth.uid() = user_id);

create policy wear_events_insert_own on public.wear_events
for insert with check (auth.uid() = user_id);

create policy wear_events_update_own on public.wear_events
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy wear_events_delete_own on public.wear_events
for delete using (auth.uid() = user_id);

create policy user_entitlements_select_own on public.user_entitlements
for select using (auth.uid() = user_id);

create policy user_entitlements_insert_own on public.user_entitlements
for insert with check (auth.uid() = user_id);

create policy user_entitlements_update_own on public.user_entitlements
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy user_entitlements_delete_own on public.user_entitlements
for delete using (auth.uid() = user_id);

create policy lookbook_entries_select_own on public.lookbook_entries
for select using (auth.uid() = user_id);

create policy lookbook_entries_insert_own on public.lookbook_entries
for insert with check (auth.uid() = user_id);

create policy lookbook_entries_update_own on public.lookbook_entries
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy lookbook_entries_delete_own on public.lookbook_entries
for delete using (auth.uid() = user_id);

create policy lookbook_items_select_own on public.lookbook_items
for select using (
  exists (
    select 1 from public.lookbook_entries le
    where le.id = lookbook_items.lookbook_entry_id
      and le.user_id = auth.uid()
  )
);

create policy lookbook_items_insert_own on public.lookbook_items
for insert with check (
  exists (
    select 1 from public.lookbook_entries le
    where le.id = lookbook_items.lookbook_entry_id
      and le.user_id = auth.uid()
  )
);

create policy lookbook_items_update_own on public.lookbook_items
for update using (
  exists (
    select 1 from public.lookbook_entries le
    where le.id = lookbook_items.lookbook_entry_id
      and le.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lookbook_entries le
    where le.id = lookbook_items.lookbook_entry_id
      and le.user_id = auth.uid()
  )
);

create policy lookbook_items_delete_own on public.lookbook_items
for delete using (
  exists (
    select 1 from public.lookbook_entries le
    where le.id = lookbook_items.lookbook_entry_id
      and le.user_id = auth.uid()
  )
);

create policy outfits_select_own on public.outfits
for select using (auth.uid() = user_id);

create policy outfits_insert_own on public.outfits
for insert with check (auth.uid() = user_id);

create policy outfits_update_own on public.outfits
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy outfits_delete_own on public.outfits
for delete using (auth.uid() = user_id);

create policy outfit_items_select_own on public.outfit_items
for select using (
  exists (
    select 1 from public.outfits o
    where o.id = outfit_items.outfit_id
      and o.user_id = auth.uid()
  )
);

create policy outfit_items_insert_own on public.outfit_items
for insert with check (
  exists (
    select 1 from public.outfits o
    where o.id = outfit_items.outfit_id
      and o.user_id = auth.uid()
  )
);

create policy outfit_items_update_own on public.outfit_items
for update using (
  exists (
    select 1 from public.outfits o
    where o.id = outfit_items.outfit_id
      and o.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.outfits o
    where o.id = outfit_items.outfit_id
      and o.user_id = auth.uid()
  )
);

create policy outfit_items_delete_own on public.outfit_items
for delete using (
  exists (
    select 1 from public.outfits o
    where o.id = outfit_items.outfit_id
      and o.user_id = auth.uid()
  )
);

create policy garment_colours_select_own on public.garment_colours
for select using (
  exists (
    select 1 from public.garments g
    where g.id = garment_colours.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_colours_insert_own on public.garment_colours
for insert with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_colours.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_colours_update_own on public.garment_colours
for update using (
  exists (
    select 1 from public.garments g
    where g.id = garment_colours.garment_id
      and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.garments g
    where g.id = garment_colours.garment_id
      and g.user_id = auth.uid()
  )
);

create policy garment_colours_delete_own on public.garment_colours
for delete using (
  exists (
    select 1 from public.garments g
    where g.id = garment_colours.garment_id
      and g.user_id = auth.uid()
  )
);

create policy user_trend_matches_select_own on public.user_trend_matches
for select using (auth.uid() = user_id);

create policy user_trend_matches_insert_own on public.user_trend_matches
for insert with check (auth.uid() = user_id);

create policy user_trend_matches_update_own on public.user_trend_matches
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy user_trend_matches_delete_own on public.user_trend_matches
for delete using (auth.uid() = user_id);

create policy weather_snapshots_select_own on public.weather_snapshots
for select using (auth.uid() = user_id or user_id is null);

create policy weather_snapshots_insert_own on public.weather_snapshots
for insert with check (auth.uid() = user_id);

create policy weather_snapshots_update_own on public.weather_snapshots
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy weather_snapshots_delete_own on public.weather_snapshots
for delete using (auth.uid() = user_id);

create policy occasion_profiles_select_own on public.occasion_profiles
for select using (auth.uid() = user_id or user_id is null);

create policy occasion_profiles_insert_own on public.occasion_profiles
for insert with check (auth.uid() = user_id);

create policy occasion_profiles_update_own on public.occasion_profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy occasion_profiles_delete_own on public.occasion_profiles
for delete using (auth.uid() = user_id);

create policy processing_jobs_select_own on public.processing_jobs
for select using (auth.uid() = user_id);

create policy processing_jobs_insert_own on public.processing_jobs
for insert with check (auth.uid() = user_id);

create policy processing_jobs_update_own on public.processing_jobs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy processing_jobs_delete_own on public.processing_jobs
for delete using (auth.uid() = user_id);

-- Global readable tables; writes should be service-side only.

create policy colours_read_all on public.colours
for select using (true);

create policy colour_relationships_read_all on public.colour_relationships
for select using (true);

create policy style_rules_read_global_or_own on public.style_rules
for select using (
  public.is_global_rule(rule_scope) or user_id = auth.uid()
);

create policy style_rules_insert_user_only on public.style_rules
for insert with check (
  (rule_scope = 'user' and user_id = auth.uid())
);

create policy style_rules_update_global_or_own on public.style_rules
for update using (
  (rule_scope = 'user' and user_id = auth.uid())
)
with check (
  (rule_scope = 'user' and user_id = auth.uid())
);

create policy style_rules_delete_own on public.style_rules
for delete using (
  rule_scope = 'user' and user_id = auth.uid()
);

create policy trend_sources_read_all on public.trend_sources
for select using (true);

create policy trend_signals_read_all on public.trend_signals
for select using (true);

create policy trend_signal_sources_read_all on public.trend_signal_sources
for select using (true);

create policy trend_colours_read_all on public.trend_colours
for select using (true);

create policy trend_ingestion_jobs_no_public_access on public.trend_ingestion_jobs
for select using (false);

-- =============================================================================
-- Seed global style rules
-- =============================================================================

insert into public.style_rules (
  rule_type, subject_type, subject_value, predicate, object_type, object_value, weight, rule_scope, explanation
) values
  ('colour_pairing', 'colour_family', 'beige', 'pairs_with', 'colour_family', 'navy', 0.95, 'global', 'Beige and navy create a polished neutral contrast often suitable for workwear.'),
  ('occasion_fit', 'category', 'white shirt', 'appropriate_for', 'occasion', 'business_casual', 0.95, 'global', 'A white shirt is a strong business-casual base layer.'),
  ('weather_fit', 'category', 'sandals', 'avoid_with', 'weather', 'cold_rain', 0.99, 'global', 'Sandals are generally a poor choice in cold rainy weather.'),
  ('layering', 'category', 'knitwear', 'layerable_with', 'category', 'coat', 0.90, 'global', 'Knitwear often layers well with coats in cooler weather.'),
  ('silhouette', 'category', 'wide_leg_trousers', 'pairs_with', 'category', 'fitted_top', 0.85, 'global', 'Wide-leg trousers usually balance well with a more fitted top.');

-- =============================================================================
-- Storage buckets (optional for Supabase SQL migrations)
-- Requires service role / elevated privileges when executed in Supabase.
-- Uncomment if you want bucket creation in migration form.
-- =============================================================================
--
-- insert into storage.buckets (id, name, public)
-- values
--   ('garment-originals', 'garment-originals', false),
--   ('garment-cutouts', 'garment-cutouts', false),
--   ('lookbook-images', 'lookbook-images', false),
--   ('receipt-uploads', 'receipt-uploads', false),
--   ('source-thumbnails', 'source-thumbnails', false)
-- on conflict (id) do nothing;

commit;
