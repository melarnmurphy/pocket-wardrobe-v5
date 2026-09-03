import { cache } from "react";
import { z } from "zod";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const accountProfileSchema = z.object({
  email: z.string().email().nullable(),
  display_name: z.string().trim().max(80).nullable(),
  preferred_location: z.string().trim().max(160).nullable(),
  region: z.enum(["AU", "NZ"]).default("AU"),
  temperature_unit: z.enum(["C", "F"]).default("C"),
  currency_unit: z.enum(["AUD", "NZD"]).default("AUD")
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

function getEnumFromMetadata<T extends string>(metadata: unknown, key: string, values: readonly T[]): T | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export const getAccountProfile = cache(async (): Promise<AccountProfile> => {
  const user = await getRequiredUser();
  return accountProfileSchema.parse({
    email: user.email ?? null,
    display_name: getDisplayNameFromMetadata(user.user_metadata),
    preferred_location: getPreferredLocationFromMetadata(user.user_metadata),
    region: getEnumFromMetadata(user.user_metadata, "region", ["AU", "NZ"] as const) ?? "AU",
    temperature_unit: getEnumFromMetadata(user.user_metadata, "temperature_unit", ["C", "F"] as const) ?? "C",
    currency_unit: getEnumFromMetadata(user.user_metadata, "currency_unit", ["AUD", "NZD"] as const) ?? "AUD"
  });
});

export async function updateAccountProfile(input: {
  display_name: string | null;
  preferred_location: string | null;
  region?: "AU" | "NZ";
  temperature_unit?: "C" | "F";
  currency_unit?: "AUD" | "NZD";
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

  if (input.region) existingMetadata.region = input.region;
  if (input.temperature_unit) existingMetadata.temperature_unit = input.temperature_unit;
  if (input.currency_unit) existingMetadata.currency_unit = input.currency_unit;

  const { error } = await supabase.auth.updateUser({ data: existingMetadata });
  if (error) throw new Error(error.message);

  return getAccountProfile();
}

// Every real upload path (lib/domain/wardrobe/service.ts, lib/domain/ingestion/service.ts)
// writes garment_images.storage_path into this bucket regardless of image_type — the
// "garment-cutouts" bucket only ever holds ephemeral draft-review crops that never become
// garment_images rows, so there is no image_type whose object actually lives anywhere else.
const ORIGINAL_BUCKET = "garment-originals";

/**
 * MODALS.md §5 — "delete my photos, keep the records": removes every photo
 * from every garment this user owns, but never touches the garments
 * themselves (name, wear history, prices, looks all stay exactly as they
 * are). Storage removal is best-effort — a storage error never blocks the
 * database cleanup, since a stray object left in storage is recoverable but
 * a photo the user was told was gone and was not is not.
 */
export async function deleteAllUserPhotos(): Promise<{ deletedCount: number }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: garments, error: garmentsError } = await supabase
    .from("garments")
    .select("id")
    .eq("user_id", user.id);

  if (garmentsError) {
    throw new Error(garmentsError.message);
  }

  const garmentIds = ((garments ?? []) as { id: string }[]).map((garment) => garment.id);

  if (garmentIds.length === 0) {
    return { deletedCount: 0 };
  }

  const { data: images, error: imagesError } = await supabase
    .from("garment_images")
    .select("id,garment_id,image_type,storage_path")
    .in("garment_id", garmentIds);

  if (imagesError) {
    throw new Error(imagesError.message);
  }

  const rows = (images ?? []) as {
    id: string;
    garment_id: string;
    image_type: string;
    storage_path: string;
  }[];

  for (const image of rows) {
    await supabase.storage.from(ORIGINAL_BUCKET).remove([image.storage_path]);
  }

  if (rows.length > 0) {
    const { error: deleteError } = await supabase
      .from("garment_images")
      .delete()
      .in(
        "id",
        rows.map((image) => image.id)
      );

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return { deletedCount: rows.length };
}
