import type { createClient } from "@/lib/supabase/server";

/**
 * Optional override for the request-scoped Supabase client + user id that
 * server-only service functions otherwise pull from cookies via
 * lib/supabase/server.ts + lib/auth.ts. Passed by the mobile API routes
 * (lib/auth-mobile.ts), which authenticate with a bearer token instead of a
 * cookie session. Web call sites omit this and keep the existing behaviour.
 *
 * `supabase` is typed against the cookie-based client's own return type
 * (rather than a fresh `SupabaseClient<Database>`) because the generated
 * Database type produces incompatible generic instantiations across
 * call sites otherwise — see lib/supabase/mobile.ts for the matching cast.
 */
export type ServiceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};
