-- Phase 12 (local threads trust and safety): decline/withdraw an offer,
-- cancel a listing with a live offer, cancel/reschedule a handover, "they
-- didn't show", report, block, first-listing safety brief, and age check.
-- See docs/design/design_handoff_garderobe/LOCAL_THREADS_TRUST_SAFETY_SPEC.md.

-- Offers today are plain messages (kind = 'offer') with no accept/decline/
-- withdraw state at all. This adds that state directly on the message row
-- rather than a separate offers table, since a message row already *is*
-- the one-offer-per-send record MODALS.md's "counter / accept" dialog acts
-- on.
alter table public.messages
  add column if not exists offer_status text
    check (offer_status in ('pending', 'accepted', 'declined', 'withdrawn'))
    default 'pending';

-- Migration 031 gave messages a select and an insert policy but no update
-- policy, so an update matched zero rows under RLS default-deny and
-- returned no error at all. respondToOffer/withdrawOffer in
-- lib/domain/local-threads/threads-service.ts need to flip offer_status on
-- an existing 'offer' message, so this adds the missing policy, scoped to
-- offer rows only so plain text/system message bodies stay immutable.
drop policy if exists messages_update_participant on public.messages;
create policy messages_update_participant on public.messages
  for update using (
    kind = 'offer'
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  )
  with check (
    kind = 'offer'
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

-- "They didn't show" needs to record who. The handovers.state check
-- constraint already allows 'missed' (migration 031) but no code has ever
-- written it. on delete set null, matching the column's nullable intent:
-- the no-show record survives the deleted user's departure, it just loses
-- the specific attribution.
alter table public.handovers
  add column if not exists no_show_by uuid references auth.users(id) on delete set null,
  add column if not exists no_show_reported_at timestamptz;

-- First listing safety brief and the age gate, same pattern as the
-- existing onboarding_completed_at column.
alter table public.profiles
  add column if not exists local_safety_brief_seen_at timestamptz,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists age_declined_at timestamptz;
