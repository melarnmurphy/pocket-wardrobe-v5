-- The get_blocked_user_names() revoke in migration 039 only revoked from
-- PUBLIC, but Supabase's default privileges grant EXECUTE on new functions
-- directly to anon (not via PUBLIC), so a PUBLIC-only revoke leaves the
-- unauthenticated anon role still able to call this function. Confirmed via
-- the security advisor (anon_security_definer_function_executable) after
-- applying 039. Close it explicitly.
revoke execute on function public.get_blocked_user_names(uuid[]) from anon;
