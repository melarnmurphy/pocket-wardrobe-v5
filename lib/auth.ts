import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {
  constructor() {
    super("You must be signed in to access Pocket Wardrobe.");
    this.name = "AuthenticationError";
  }
}

type SupabaseClaims = {
  sub: string;
  aud?: string | string[];
  email?: string;
  phone?: string;
  role?: string;
  iat?: number;
  app_metadata?: User["app_metadata"];
  user_metadata?: User["user_metadata"];
};

// Build the subset of the Supabase User shape our app reads (id, email,
// user_metadata, app_metadata) from verified JWT claims, so callers don't need
// to change. created_at is reconstructed from the token's issued-at claim; no
// caller currently reads it.
function userFromClaims(claims: SupabaseClaims): User {
  return {
    id: claims.sub,
    aud: Array.isArray(claims.aud) ? claims.aud[0] ?? "" : claims.aud ?? "",
    email: claims.email,
    phone: claims.phone,
    role: claims.role,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    created_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : ""
  };
}

// We use getClaims() rather than getUser() to identify the request's user.
// getUser() makes a network round-trip to the Auth server on every request;
// getClaims() verifies the JWT's signature locally against the project's
// (asymmetric) signing keys — the JWKS is fetched once and cached — so it adds
// no per-request latency. Trade-off: a token revoked mid-session stays valid
// until it expires, which is acceptable for these RLS-protected reads.
export const getRequiredUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    throw new AuthenticationError();
  }

  return userFromClaims(data.claims);
});

export const getOptionalUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    return userFromClaims(data.claims);
  } catch {
    return null;
  }
});
