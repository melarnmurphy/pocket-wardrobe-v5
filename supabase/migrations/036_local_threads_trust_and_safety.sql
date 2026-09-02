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

-- "They didn't show" needs to record who — the handovers.state check
-- constraint already allows 'missed' (migration 031) but no code has ever
-- written it.
alter table public.handovers
  add column if not exists no_show_by uuid references auth.users(id),
  add column if not exists no_show_reported_at timestamptz;

-- First listing safety brief and the age gate, same pattern as the
-- existing onboarding_completed_at column.
alter table public.profiles
  add column if not exists local_safety_brief_seen_at timestamptz,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists age_declined_at timestamptz;
