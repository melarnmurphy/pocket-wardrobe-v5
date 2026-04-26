import { z } from "zod";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const accountProfileSchema = z.object({
  email: z.string().email().nullable(),
  preferred_location: z.string().trim().max(160).nullable()
});

export type AccountProfile = z.infer<typeof accountProfileSchema>;

export function getPreferredLocationFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = (metadata as { preferred_location?: unknown }).preferred_location;

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length ? trimmedValue : null;
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const user = await getRequiredUser();

  return accountProfileSchema.parse({
    email: user.email ?? null,
    preferred_location: getPreferredLocationFromMetadata(user.user_metadata)
  });
}

export async function updateAccountProfile(input: { preferred_location: string | null }) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const existingMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? { ...(user.user_metadata as Record<string, unknown>) }
      : {};

  if (input.preferred_location) {
    existingMetadata.preferred_location = input.preferred_location;
  } else {
    delete existingMetadata.preferred_location;
  }

  const { error } = await supabase.auth.updateUser({
    data: existingMetadata
  });

  if (error) {
    throw new Error(error.message);
  }

  return getAccountProfile();
}
