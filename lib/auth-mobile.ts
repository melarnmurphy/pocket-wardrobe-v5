import type { NextRequest } from "next/server";
import { AuthenticationError, userFromClaims } from "@/lib/auth";
import { createMobileClient } from "@/lib/supabase/mobile";

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length ? token : null;
}

/**
 * Verifies the request's bearer token locally (no network round-trip, same
 * approach as lib/auth.ts's getRequiredUser) and returns a mobile-scoped
 * Supabase client whose requests carry that token, so RLS sees the same
 * auth.uid() a cookie-authenticated web request would.
 */
export async function getRequiredMobileUser(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token) throw new AuthenticationError();

  const supabase = createMobileClient(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new AuthenticationError();
  }

  return { user: userFromClaims(data.claims), supabase };
}
