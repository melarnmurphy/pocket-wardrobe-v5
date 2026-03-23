import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {
  constructor() {
    super("You must be signed in to access Pocket Wardrobe.");
    this.name = "AuthenticationError";
  }
}

export const getRequiredUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
});

export const getOptionalUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
});
