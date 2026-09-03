-- "blocked · N people" (account page) needs to show who was blocked. A
-- blocker has necessarily already interacted with this person (via a
-- listing or thread) before blocking them, and their local_name is already
-- visible elsewhere in the app in that context — this policy does not
-- expose anything new, only lets the blocked-list query read it directly
-- rather than through the now-severed thread relationship.
--
-- One-directional: only the blocker gains this read, never the blocked
-- user — a blocked user must not gain any new visibility into who blocked
-- them.
create policy profiles_select_via_block on public.profiles
  for select using (
    exists (
      select 1 from public.user_blocks b
      where b.blocked_id = profiles.user_id
        and b.blocker_id = auth.uid()
    )
  );
