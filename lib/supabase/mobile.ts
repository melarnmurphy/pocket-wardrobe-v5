import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import type { createClient } from "@/lib/supabase/server";

/**
 * A Supabase client authenticated with a bearer access token rather than
 * cookies, for the native iOS client. Every request carries the token as its
 * Authorization header, so PostgREST/RLS sees the same auth.uid() a cookie
 * session would produce — no service-role key, no elevated access.
 *
 * Cast to the cookie-based client's own type: functionally the same
 * PostgREST/Auth protocol, but `createServerClient` and the plain
 * `supabase-js` `createClient` infer different (incompatible) generic
 * instantiations of `Database` otherwise. See lib/domain/service-context.ts.
 */
export function createMobileClient(accessToken: string): Awaited<ReturnType<typeof createClient>> {
  const env = getPublicEnv();
  const client = createSupabaseJsClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return client as unknown as Awaited<ReturnType<typeof createClient>>;
}
