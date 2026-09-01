import { z } from "zod";

export const LOCAL_LISTING_STATUS_VALUES = [
  "draft",
  "live",
  "reserved",
  "handover arranged",
  "sold",
  "expired",
  "withdrawn"
] as const;
export const localListingStatusSchema = z.enum(LOCAL_LISTING_STATUS_VALUES);

export const NEARBY_SORT_VALUES = ["closest", "newest", "finishes a look", "price"] as const;
export const nearbySortSchema = z.enum(NEARBY_SORT_VALUES);
export type NearbySort = z.infer<typeof nearbySortSchema>;

export const nearbyQuerySchema = z.object({
  radiusKm: z.number().int().min(5).max(100).default(30),
  maxPriceCents: z.number().int().nonnegative().nullable().optional(),
  sort: nearbySortSchema.default("closest")
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

/** The RPC's row shape — display_lat/lng are already jittered server-side. */
export const localListingCardSchema = z.object({
  id: z.string().uuid(),
  piece_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: localListingStatusSchema,
  ask_cents: z.number().int(),
  currency: z.string(),
  negotiable: z.boolean(),
  description: z.string(),
  category: z.string(),
  subcategory: z.string().nullable(),
  photo_uris: z.array(z.string()),
  show_wear_count: z.boolean(),
  wear_count_at_listing: z.number().int().nullable(),
  size: z.string().nullable(),
  suburb: z.string(),
  display_lat: z.coerce.number(),
  display_lng: z.coerce.number(),
  distance_km: z.coerce.number(),
  views: z.number().int(),
  saves: z.number().int(),
  listed_at: z.string().nullable(),
  created_at: z.string()
});
export type LocalListingCard = z.infer<typeof localListingCardSchema>;

export const createLocalListingInputSchema = z.object({
  garment_id: z.string().uuid(),
  ask_cents: z.number().int().nonnegative(),
  negotiable: z.boolean().default(true),
  description: z.string().trim().max(2000),
  photo_uris: z.array(z.string()).default([]),
  show_wear_count: z.boolean().default(true),
  size: z.string().trim().max(40).nullable().optional()
});
export type CreateLocalListingInput = z.infer<typeof createLocalListingInputSchema>;
