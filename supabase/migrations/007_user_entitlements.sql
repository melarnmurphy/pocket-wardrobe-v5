begin;

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

create index if not exists idx_user_entitlements_plan_tier
  on public.user_entitlements(plan_tier);

drop trigger if exists trg_user_entitlements_set_updated_at on public.user_entitlements;
create trigger trg_user_entitlements_set_updated_at
before update on public.user_entitlements
for each row
execute function public.set_updated_at();

alter table public.user_entitlements enable row level security;

create policy user_entitlements_select_own on public.user_entitlements
for select using (auth.uid() = user_id);

create policy user_entitlements_insert_own on public.user_entitlements
for insert with check (auth.uid() = user_id);

create policy user_entitlements_update_own on public.user_entitlements
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy user_entitlements_delete_own on public.user_entitlements
for delete using (auth.uid() = user_id);

commit;
