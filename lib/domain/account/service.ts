import { z } from "zod";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const accountProfileSchema = z.object({
  email: z.string().email().nullable(),
  display_name: z.string().trim().max(80).nullable(),
  preferred_location: z.string().trim().max(160).nullable()
});

export type AccountProfile = z.infer<typeof accountProfileSchema>;

export function getPreferredLocationFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { preferred_location?: unknown }).preferred_location;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function getDisplayNameFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { display_name?: unknown }).display_name;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const user = await getRequiredUser();
  return accountProfileSchema.parse({
    email: user.email ?? null,
    display_name: getDisplayNameFromMetadata(user.user_metadata),
    preferred_location: getPreferredLocationFromMetadata(user.user_metadata)
  });
}

export async function updateAccountProfile(input: {
  display_name: string | null;
  preferred_location: string | null;
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const existingMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? { ...(user.user_metadata as Record<string, unknown>) }
      : {};

  if (input.display_name) {
    existingMetadata.display_name = input.display_name;
  } else {
    delete existingMetadata.display_name;
  }

  if (input.preferred_location) {
    existingMetadata.preferred_location = input.preferred_location;
  } else {
    delete existingMetadata.preferred_location;
  }

  const { error } = await supabase.auth.updateUser({ data: existingMetadata });
  if (error) throw new Error(error.message);

  return getAccountProfile();
}
