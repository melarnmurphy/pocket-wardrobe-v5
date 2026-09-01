import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/domain/profile/service";
import {
  localListingCardSchema,
  nearbyQuerySchema,
  type LocalListingCard,
  type NearbyQuery
} from "@/lib/domain/local-threads";

/**
 * 16a / w2a — the nearby feed. Centre is the viewer's own suburb centroid
 * (profiles.suburb_lat/lng), never their device location. The
 * nearby_listings() RPC (migration 029) does the haversine distance and the
 * per-listing jitter — this function never touches raw lat/lng.
 */
export async function searchNearby(
  query: NearbyQuery
): Promise<{ listings: LocalListingCard[]; total: number; centre: { lat: number; lng: number } | null }> {
  const supabase = await createClient();
  const parsedQuery = nearbyQuerySchema.parse(query);
  const profile = await getOrCreateProfile();

  if (profile.suburb_lat === null || profile.suburb_lng === null) {
    return { listings: [], total: 0, centre: null };
  }

  const { data, error } = (await supabase.rpc("nearby_listings" as never, {
    viewer_lat: profile.suburb_lat,
    viewer_lng: profile.suburb_lng,
    radius_km: parsedQuery.radiusKm,
    max_price_cents: parsedQuery.maxPriceCents ?? null,
    // "finishes a look" needs the shared unlock computation DATA_MODEL.md
    // says it reuses from the wishlist (phase 9, not yet built) — falls
    // back to closest until that exists, rather than a fabricated score.
    sort_key: parsedQuery.sort === "finishes a look" ? "closest" : parsedQuery.sort
  } as never)) as { data: unknown; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  const listings = z.array(localListingCardSchema).parse(data ?? []);
  const signedListings = await signListingPhotos(supabase, listings);

  return {
    listings: signedListings,
    total: signedListings.length,
    centre: { lat: profile.suburb_lat, lng: profile.suburb_lng }
  };
}

/**
 * photo_uris stores storage paths, not URLs — garment-originals is a
 * private bucket, so every read signs fresh rather than storing an
 * expiring signed URL on the listing.
 */
async function signListingPhotos<T extends { photo_uris: string[] }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listings: T[]
): Promise<T[]> {
  const allPaths = Array.from(new Set(listings.flatMap((listing) => listing.photo_uris)));
  if (!allPaths.length) return listings;

  const { data: signedUrls } = await supabase.storage
    .from("garment-originals")
    .createSignedUrls(allPaths, 60 * 60);

  const signedByPath = new Map<string, string>();
  for (const signed of signedUrls ?? []) {
    if (signed.path && signed.signedUrl) signedByPath.set(signed.path, signed.signedUrl);
  }

  return listings.map((listing) => ({
    ...listing,
    photo_uris: listing.photo_uris.map((path) => signedByPath.get(path) ?? path)
  }));
}

const listingDetailSchema = z.object({
  id: z.string().uuid(),
  piece_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: z.string(),
  ask_cents: z.number().int(),
  currency: z.string(),
  negotiable: z.boolean(),
  description: z.string(),
  photo_uris: z.array(z.string()),
  show_wear_count: z.boolean(),
  wear_count_at_listing: z.number().int().nullable(),
  size: z.string().nullable(),
  suburb: z.string(),
  views: z.number().int(),
  saves: z.number().int(),
  listed_at: z.string().nullable(),
  created_at: z.string()
});
export type LocalListingDetail = z.infer<typeof listingDetailSchema>;

/**
 * 16b / w2b — a listing. Column list deliberately excludes lat/lng: RLS
 * gates which *rows* a viewer can read (status='live' or their own), but a
 * live row is visible to any authenticated user, so the exact point must
 * never be in the select list here — "no exact location, ever, to either
 * party, at any listing state" (standing rule).
 */
export async function getLocalListingDetail(listingId: string): Promise<LocalListingDetail | null> {
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(listingId);

  const { data, error } = await supabase
    .from("local_listings")
    .select(
      "id,piece_id,seller_id,status,ask_cents,currency,negotiable,description,photo_uris,show_wear_count,wear_count_at_listing,size,suburb,views,saves,listed_at,created_at"
    )
    .eq("id", parsedId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  const parsed = listingDetailSchema.parse(data);
  const [signed] = await signListingPhotos(supabase, [parsed]);
  return signed;
}

/** Fire-and-forget view counter — best-effort, never blocks the page render. */
export async function incrementListingViews(listingId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_local_listing_views" as never, {
    listing_id: listingId
  } as never);
}

export async function listMyLocalListings() {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("local_listings")
    .select(
      "id,piece_id,seller_id,status,ask_cents,currency,negotiable,description,photo_uris,show_wear_count,wear_count_at_listing,size,suburb,views,saves,listed_at,created_at"
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(listingDetailSchema).parse(data ?? []);
}
