-- Phase 8 (local threads, transactional): 16c/w2c list it locally, 16d/w2d
-- thread + offers + handover, block and report, realtime on messages.
-- See docs/design/design_handoff_garderobe/DATA_MODEL.md "Local threads".
--
-- Standing rule: Garderobe processes no payments. payment_method on
-- handovers is a label of what the two people did (cash, payid, bank
-- transfer) — recorded, never validated, never processed. No escrow, no
-- fees, no wallet, and this migration contains no payment code.

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.local_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'open'
    check (state in ('open', 'handover arranged', 'completed', 'declined', 'expired', 'blocked')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'offer', 'handover proposal', 'system')),
  body text not null default '',
  offer_cents integer check (offer_cents is null or offer_cents >= 0),
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  place_name text not null,
  place_suburb text not null,
  place_note text,
  at timestamptz not null,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  state text not null default 'proposed'
    check (state in ('proposed', 'agreed', 'completed', 'missed', 'cancelled')),
  -- A label of what the two people did, nothing more. Never validated,
  -- never processed, never touches a payment provider.
  payment_method text check (payment_method is null or payment_method in ('cash', 'payid', 'bank transfer')),
  completed_at timestamptz,
  seller_confirmed boolean not null default false,
  buyer_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.local_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Realtime on messages (16d/w2d) — the thread subscribes to inserts
-- filtered by thread_id from the client.
alter publication supabase_realtime add table public.messages;

create index if not exists threads_buyer_idx on public.threads (buyer_id);
create index if not exists threads_seller_idx on public.threads (seller_id);
create index if not exists messages_thread_idx on public.messages (thread_id, sent_at);
create index if not exists handovers_thread_idx on public.handovers (thread_id);
create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);

alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.handovers enable row level security;
alter table public.user_blocks enable row level security;
alter table public.listing_reports enable row level security;

create policy threads_select_participant on public.threads
for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy threads_insert_buyer on public.threads
for insert with check (
  auth.uid() = buyer_id
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = seller_id and b.blocked_id = buyer_id)
       or (b.blocker_id = buyer_id and b.blocked_id = seller_id)
  )
);

create policy threads_update_participant on public.threads
for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy messages_select_participant on public.messages
for select using (
  exists (
    select 1 from public.threads t
    where t.id = messages.thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy messages_insert_participant on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.threads t
    where t.id = messages.thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
      and t.state not in ('declined', 'expired', 'blocked')
  )
);

create policy handovers_select_participant on public.handovers
for select using (
  exists (
    select 1 from public.threads t
    where t.id = handovers.thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy handovers_insert_participant on public.handovers
for insert with check (
  proposed_by = auth.uid()
  and exists (
    select 1 from public.threads t
    where t.id = handovers.thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy handovers_update_participant on public.handovers
for update using (
  exists (
    select 1 from public.threads t
    where t.id = handovers.thread_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy user_blocks_select_own on public.user_blocks
for select using (auth.uid() = blocker_id);

create policy user_blocks_insert_own on public.user_blocks
for insert with check (auth.uid() = blocker_id);

create policy user_blocks_delete_own on public.user_blocks
for delete using (auth.uid() = blocker_id);

create policy listing_reports_insert_own on public.listing_reports
for insert with check (auth.uid() = reporter_id);

create policy listing_reports_select_own on public.listing_reports
for select using (auth.uid() = reporter_id);

drop trigger if exists trg_handovers_set_updated_at on public.handovers;
create trigger trg_handovers_set_updated_at
before update on public.handovers
for each row execute function public.set_updated_at();

-- Mutual and immediate: a blocked user's listings disappear from each
-- other's feeds. Extends the phase-7 policy rather than replacing it.
drop policy if exists local_listings_select_live_or_own on public.local_listings;
create policy local_listings_select_live_or_own on public.local_listings
for select using (
  (status = 'live' or seller_id = auth.uid())
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = local_listings.seller_id)
       or (b.blocker_id = local_listings.seller_id and b.blocked_id = auth.uid())
  )
);

-- Second confirmation archives the piece, closes the thread, and writes
-- sold_for — see lib/domain/local-threads/service.ts's confirmHandover.
-- This function only touches garments/local_listings/threads/handovers; it
-- has no notion of money moving, only that a handover was marked done.
create or replace function complete_handover(p_handover_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_listing_id uuid;
  v_piece_id uuid;
  v_ask_cents integer;
begin
  select thread_id into v_thread_id
  from public.handovers
  where id = p_handover_id and seller_confirmed and buyer_confirmed and state <> 'completed';

  if v_thread_id is null then
    return;
  end if;

  select listing_id into v_listing_id from public.threads where id = v_thread_id;
  select piece_id, ask_cents into v_piece_id, v_ask_cents
  from public.local_listings where id = v_listing_id;

  update public.handovers
  set state = 'completed', completed_at = now()
  where id = p_handover_id;

  update public.threads
  set state = 'completed'
  where id = v_thread_id;

  update public.local_listings
  set status = 'sold', sold_at = now(), sold_for_cents = v_ask_cents
  where id = v_listing_id;

  -- Soft archive, same as archiveGarment in lib/domain/wardrobe/service.ts —
  -- keeps wear history; the looks it was in keep their photos untouched.
  update public.garments
  set archived_at = now(), archive_reason = 'sold locally', availability = 'wearable'
  where id = v_piece_id and archived_at is null;
end;
$$;
