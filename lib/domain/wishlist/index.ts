import { z } from "zod";

export const wishlistSortSchema = z.enum(["unlocks", "priceDrop", "saved"]);
export type WishlistSort = z.infer<typeof wishlistSortSchema>;

export const addWishlistItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  image_path: z.string().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("AUD"),
  category: z.string().trim().max(100).nullable().optional(),
  colour_family: z.string().trim().max(60).nullable().optional(),
  size: z.string().trim().max(40).nullable().optional(),
  watch_price: z.boolean().default(true)
});
export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;

export const wishlistEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  image_path: z.string().nullable(),
  source_url: z.string().nullable(),
  price_cents: z.number().int().nullable(),
  original_price_cents: z.number().int().nullable(),
  currency: z.string(),
  category: z.string().nullable(),
  colour_family: z.string().nullable(),
  size: z.string().nullable(),
  watch_price: z.boolean(),
  resolved_state: z.string(),
  bought_garment_id: z.string().uuid().nullable(),
  created_at: z.string()
});
export type WishlistEntry = z.infer<typeof wishlistEntrySchema>;

export type WishlistCard = WishlistEntry & {
  unlockCount: number;
  ownedSimilarCount: number;
};
