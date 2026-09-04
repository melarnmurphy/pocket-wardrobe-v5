import { cache } from "react";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { listMyThreads, withdrawLocalListing } from "@/lib/domain/local-threads/threads-service";

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

// providedUser lets a mobile route pass its bearer-token-derived user (which
// getRequiredUser, being cookie-only, cannot see) instead of re-deriving one.
export const getAccountProfile = cache(async (providedUser?: User): Promise<AccountProfile> => {
  const user = providedUser ?? (await getRequiredUser());
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

// Which bucket a garment_images row's file actually lives in depends on which upload path
// produced it: lib/domain/wardrobe/service.ts writes some cutout/cropped rows into
// "garment-originals", while lib/domain/ingestion/service.ts uploads draft crops into
// "garment-cutouts" and app/wardrobe/review/actions.ts persists them as garment_images rows
// pointing at that same bucket when a draft is accepted. Since removal here is already
// best-effort and Supabase storage remove() on a path that does not exist in a given bucket
// is a safe no-op, we attempt removal from both buckets for every row rather than trying to
// infer the right one from image_type.
const GARMENT_IMAGE_BUCKETS = ["garment-originals", "garment-cutouts"] as const;

/**
 * MODALS.md §5 - "delete my photos, keep the records": removes every photo
 * from every garment this user owns, but never touches the garments
 * themselves (name, wear history, prices, looks all stay exactly as they
 * are). Storage removal is best-effort: a storage error never blocks the
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
    for (const bucket of GARMENT_IMAGE_BUCKETS) {
      await supabase.storage.from(bucket).remove([image.storage_path]);
    }
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

const LIVE_LISTING_STATUSES = ["live", "reserved", "handover arranged"] as const;
const OPEN_THREAD_STATES = ["open", "handover arranged"] as const;

/**
 * MODALS.md §5, "close the account": must say what happens to live
 * listings and open threads before the type-to-confirm gate. A listing is
 * "live" while its status is live, reserved, or mid-handover; a thread is
 * "open" while its state is open or mid-handover (supabase/migrations/029
 * and /031).
 */
export async function getAccountClosureBlockers(): Promise<{
  liveListingCount: number;
  liveListingIds: string[];
  openThreadCount: number;
}> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error: listingsError } = await supabase
    .from("local_listings")
    .select("id")
    .eq("seller_id", user.id)
    .in("status", [...LIVE_LISTING_STATUSES]);

  if (listingsError) {
    throw new Error(listingsError.message);
  }

  const listings = (data ?? []) as { id: string }[];

  const threads = await listMyThreads();
  const openThreadCount = threads.filter((thread) =>
    (OPEN_THREAD_STATES as readonly string[]).includes(thread.state)
  ).length;

  return {
    liveListingCount: listings.length,
    liveListingIds: listings.map((listing) => listing.id),
    openThreadCount
  };
}

/**
 * MODALS.md §5, "export started / export ready" toast. This records that a
 * user asked for their data; it does not generate an export file, since no
 * export pipeline exists in this codebase yet. status/ready_at are the hook
 * a real export worker would set once one is built, flipping status to
 * 'ready' and setting ready_at.
 */
export async function requestDataExport(): Promise<{ id: string; requestedAt: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("data_export_requests")
    .insert({ user_id: user.id } as never)
    .select("id,requested_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { id: string; requested_at: string };

  return { id: row.id, requestedAt: row.requested_at };
}

export async function getLatestDataExportRequest(): Promise<{
  id: string;
  requestedAt: string;
  readyAt: string | null;
  status: "requested" | "ready";
} | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("data_export_requests")
    .select("id,requested_at,ready_at,status")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as {
    id: string;
    requested_at: string;
    ready_at: string | null;
    status: "requested" | "ready";
  }[];
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    requestedAt: row.requested_at,
    readyAt: row.ready_at,
    status: row.status
  };
}

/**
 * Withdraws every live listing (so they stop appearing in the nearby feed
 * before the account disappears out from under them), then deletes the
 * auth user. Every user-owned table in this schema is
 * `references auth.users(id) on delete cascade`, so this one delete is
 * enough to remove the rest: garments, threads, messages, handovers,
 * profile, entitlements, everything. Also signs the browser's own session
 * out, since deleting the user does not by itself invalidate a still-valid
 * access token sitting in the browser's cookies.
 */
export async function closeUserAccount(): Promise<void> {
  const user = await getRequiredUser();
  const blockers = await getAccountClosureBlockers();

  for (const listingId of blockers.liveListingIds) {
    await withdrawLocalListing(listingId);
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.deleteUser(user.id);

  if (error) {
    throw new Error(error.message);
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
}
