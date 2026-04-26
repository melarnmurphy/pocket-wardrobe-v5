alter table public.trend_signals
  add column if not exists canonical_label text,
  add column if not exists vertical text,
  add column if not exists family text,
  add column if not exists subfamily text,
  add column if not exists micro_signal text,
  add column if not exists trend_status text check (
    trend_status in ('candidate', 'emerging', 'confirmed', 'dominant', 'cooling', 'flat') or trend_status is null
  ),
  add column if not exists trend_confidence numeric(5,2),
  add column if not exists score_30d_delta numeric(8,4);

update public.trend_signals
set canonical_label = coalesce(canonical_label, label),
    trend_confidence = coalesce(trend_confidence, confidence_score)
where canonical_label is null
   or trend_confidence is null;

create table if not exists public.trend_entities (
  id uuid primary key default gen_random_uuid(),
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('brand', 'model', 'collaboration', 'runway_reference', 'retailer_example', 'editorial_example')
  ),
  label text not null,
  normalized_label text not null,
  brand text,
  source_count integer not null default 1,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trend_signal_metrics (
  id uuid primary key default gen_random_uuid(),
  trend_signal_id uuid not null references public.trend_signals(id) on delete cascade,
  metric_date date not null,
  search_interest numeric(8,4),
  search_velocity numeric(8,4),
  editorial_mentions integer not null default 0,
  editorial_source_count integer not null default 0,
  commerce_signal numeric(8,4),
  retailer_count integer not null default 0,
  resale_signal numeric(8,4),
  runway_signal numeric(8,4),
  entity_count integer not null default 0,
  composite_score numeric(8,4),
  confidence numeric(8,4),
  status text check (
    status in ('candidate', 'emerging', 'confirmed', 'dominant', 'cooling', 'flat', 'rising') or status is null
  ),
  created_at timestamptz not null default now(),
  unique (trend_signal_id, metric_date)
);

create index if not exists idx_trend_signals_canonical_label on public.trend_signals(canonical_label);
create index if not exists idx_trend_signals_family on public.trend_signals(family, subfamily);
create index if not exists idx_trend_entities_signal_id on public.trend_entities(trend_signal_id);
create index if not exists idx_trend_entities_normalized_label on public.trend_entities(normalized_label);
create index if not exists idx_trend_signal_metrics_signal_date on public.trend_signal_metrics(trend_signal_id, metric_date desc);

alter table public.trend_entities enable row level security;
alter table public.trend_signal_metrics enable row level security;

create policy trend_entities_read_all on public.trend_entities
for select using (true);

create policy trend_signal_metrics_read_all on public.trend_signal_metrics
for select using (true);
