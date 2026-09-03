-- "blocked · N people" (account page) needs to show who was blocked. A
-- row-level select policy on profiles cannot be limited to specific
-- columns, so granting the blocker select on the blocked user's profiles
-- row would also hand over suburb, suburb_lat/suburb_lng (even when
-- show_suburb is false), sizes, height_cm and the age-check flags, far
-- more than the feature needs, and reachable by anyone who inserts one
-- user_blocks row naming a stranger, since blockUser requires no prior
-- relationship. Instead this grants a security definer function that
-- returns only (user_id, local_name), scoped to the caller's own blocks,
-- and nothing else about a blocked user's profile is exposed.
--
-- One-directional: only the blocker gains this read, never the blocked
-- user, a blocked user must not gain any new visibility into who blocked
-- them.
drop function if exists public.get_blocked_user_names(uuid[]);
create or replace function public.get_blocked_user_names(p_user_ids uuid[])
returns table (user_id uuid, local_name text)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.local_name
  from public.profiles p
  where p.user_id = any(p_user_ids)
    and exists (
      select 1 from public.user_blocks b
      where b.blocked_id = p.user_id
        and b.blocker_id = auth.uid()
    );
$$;

revoke all on function public.get_blocked_user_names(uuid[]) from public;
grant execute on function public.get_blocked_user_names(uuid[]) to authenticated;
